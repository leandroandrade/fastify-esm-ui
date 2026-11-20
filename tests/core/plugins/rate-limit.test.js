import { describe, test } from 'node:test';
import { withApp, withTrustedProxyIps } from '../../shared/helper.js';

// Documentation routes (TEST-NET-3), so no test ever keys the limiter on a real address.
const CLIENT_IP = '203.0.113.9';

// The peer `inject` opens the connection from in the proxied requests below. Declaring it
// is what makes X-Forwarded-For count, the same role the edge has in production.
const PROXY_IP = '172.16.0.1';

async function countStatuses(fastify, request, times) {
  const statuses = {};

  for (let attempt = 0; attempt < times; attempt++) {
    const response = await fastify.inject(request);
    statuses[response.statusCode] = (statuses[response.statusCode] || 0) + 1;
  }

  return statuses;
}

// A request shaped the way a proxy would leave it: an entry the caller wrote, then one a
// proxy appended. Only the appended entry rotates, so the trusted proxy alone decides
// whether each request lands on its own budget — the two tests below share this and differ
// in nothing but TRUSTED_PROXY_IPS.
async function countRotatingProxyStatuses(fastify, times) {
  const statuses = {};

  for (let attempt = 0; attempt < times; attempt++) {
    const request = {
      method: 'GET',
      url: '/',
      headers: { 'x-forwarded-for': `10.0.0.77, 203.0.113.${attempt}` },
      remoteAddress: PROXY_IP
    };

    const response = await fastify.inject(request);
    statuses[response.statusCode] = (statuses[response.statusCode] || 0) + 1;
  }

  return statuses;
}

// Same shape as above, but the appended client is IPv6 and only the interface identifier
// rotates when `network` is fixed — what a single home line or VPS with a /64 can do freely.
async function countRotatingIpv6Statuses(fastify, url, toAddress, times) {
  const statuses = {};

  for (let attempt = 0; attempt < times; attempt++) {
    const request = {
      method: 'GET',
      url,
      headers: { 'x-forwarded-for': toAddress(attempt + 1) },
      remoteAddress: PROXY_IP
    };

    const response = await fastify.inject(request);
    statuses[response.statusCode] = (statuses[response.statusCode] || 0) + 1;
  }

  return statuses;
}

describe('rate-limit plugin', () => {
  // @fastify/rate-limit appends its hook to whatever the route already declares for the
  // configured phase. On `preHandler` that put the limiter *after* an auth check, so a 401
  // returned before the attempt was ever counted and a credential check — the endpoint that
  // most needs a limit — accepted unlimited guesses. On `onRequest` the limiter runs first,
  // so even a route that rejects in its own preHandler still has every attempt counted.
  test('should count attempts a route preHandler rejects against the limit', async (t) => {
    const fastify = await withApp(t);

    function rejectRequest(req, reply) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'nope' });
    }
    function handler(req, reply) {
      reply.send({ ok: true });
    }
    const options = {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: rejectRequest
    };
    fastify.get('/needs-credential', options, handler);

    const request = { method: 'GET', url: '/needs-credential', remoteAddress: CLIENT_IP };
    const statuses = await countStatuses(fastify, request, 40);

    t.assert.ok(statuses[429] > 0, 'guessing a credential should eventually be rate limited');
    t.assert.ok(statuses[401] <= 5, `at most 5 attempts should reach the preHandler, got ${statuses[401]}`);
  });

  test('should keep limiting a route that declares no preHandler of its own', async (t) => {
    const fastify = await withApp(t);

    const request = { method: 'GET', url: '/', remoteAddress: CLIENT_IP };

    const statuses = await countStatuses(fastify, request, 120);

    t.assert.ok(statuses[429] > 0, 'the global budget should still apply to the home page');
  });

  // The limiter used to exempt `127.0.0.1`. `req.ip` comes from X-Forwarded-For whenever the
  // peer is a trusted proxy, so the exemption was reachable by naming it in the header —
  // which is why this runs with a proxy trusted, the only configuration where it was.
  test('should not exempt a request claiming to come from localhost', async (t) => {
    withTrustedProxyIps(t, CLIENT_IP);
    const fastify = await withApp(t);

    const request = {
      method: 'GET',
      url: '/',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      remoteAddress: CLIENT_IP
    };

    const statuses = await countStatuses(fastify, request, 120);

    t.assert.ok(statuses[429] > 0, 'claiming to be localhost should not lift the limit');
  });

  // A trusted proxy resolves the client from the address the edge appends, so the
  // value the caller put in front of it is ignored and cannot mint a fresh budget.
  test('should key on the address the proxy appends, not the one the client sent', async (t) => {
    withTrustedProxyIps(t, PROXY_IP);
    const fastify = await withApp(t);

    const request = {
      method: 'GET',
      url: '/',
      headers: { 'x-forwarded-for': `10.0.0.77, ${CLIENT_IP}` },
      remoteAddress: PROXY_IP
    };

    const statuses = await countStatuses(fastify, request, 120);

    t.assert.ok(statuses[429] > 0, 'a spoofed leading entry should not lift the limit');
  });

  // The other half of the same setting: with the proxy trusted, the appended entry *is* the
  // client, so rotating it is rotating the client and every request gets its own budget.
  test('should give each appended address its own budget when a proxy is trusted', async (t) => {
    withTrustedProxyIps(t, PROXY_IP);
    const fastify = await withApp(t);

    const statuses = await countRotatingProxyStatuses(fastify, 120);

    t.assert.strictEqual(statuses[200], 120, 'distinct clients should not share a budget');
    t.assert.strictEqual(statuses[429], undefined);
  });

  // docker-compose publishes the port with nothing in front of it, so X-Forwarded-For is
  // entirely caller-written. Trusting a proxy there turned the request above into a bypass:
  // 120 rotations, 120 answers, no 429. Keying on the socket address is what closes it.
  test('should ignore X-Forwarded-For when no proxy is trusted', async (t) => {
    withTrustedProxyIps(t, undefined);
    const fastify = await withApp(t);

    const statuses = await countRotatingProxyStatuses(fastify, 120);

    t.assert.ok(statuses[429] > 0, 'rotating the header should not mint a fresh budget');
  });
  // A peer that is not on the list is not a proxy: the header counts for nothing, so the
  // socket address keys the limiter and rotating the header mints no budget. This is the
  // shape of a deployment whose edge range changed, which the diagnostic plugin warns about.
  test('should ignore X-Forwarded-For from a peer outside the trusted list', async (t) => {
    withTrustedProxyIps(t, '198.51.100.7');
    const fastify = await withApp(t);

    const statuses = await countRotatingProxyStatuses(fastify, 120);

    t.assert.ok(statuses[429] > 0, 'an untrusted peer should not mint a fresh budget');
  });

  // An IPv6 subscriber is handed a whole /64, so keying on the full address lets one client
  // rotate the interface identifier and never reach the limit. @fastify/rate-limit groups by
  // /64 only in its default key generator — a custom one bypasses that grouping.
  test('should share one budget across addresses of the same IPv6 /64', async (t) => {
    withTrustedProxyIps(t, PROXY_IP);
    const fastify = await withApp(t);

    function sameNetwork(index) {
      return `2001:db8:0:1::${index.toString(16)}`;
    }

    const statuses = await countRotatingIpv6Statuses(fastify, '/api/hello?name=node', sameNetwork, 130);

    t.assert.ok(statuses[429] > 0, 'rotating inside one /64 should not mint a fresh budget');
  });

  // The control for the test above: grouping is by /64, not wider, so distinct networks
  // remain distinct clients.
  test('should give each IPv6 /64 its own budget', async (t) => {
    withTrustedProxyIps(t, PROXY_IP);
    const fastify = await withApp(t);

    function distinctNetwork(index) {
      return `2001:db8:0:${index.toString(16)}::1`;
    }

    const statuses = await countRotatingIpv6Statuses(fastify, '/', distinctNetwork, 120);

    t.assert.strictEqual(statuses[200], 120, 'distinct /64 networks should not share a budget');
    t.assert.strictEqual(statuses[429], undefined);
  });
});
