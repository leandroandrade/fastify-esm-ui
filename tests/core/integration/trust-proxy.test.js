import { describe, test } from 'node:test';
import { withApp, withTrustedProxyIps } from '../../shared/helper.js';

// Under `inject` the peer is whatever `remoteAddress` says, so that is the address that has
// to be declared trusted for X-Forwarded-For to count — the same role the edge has in
// production. Documentation ranges only, so no test names a real address.
const EDGE_IP = '192.0.2.10';
const CLIENT_IP = '203.0.113.5';

async function createAppWithIpEcho(t) {
  const fastify = await withApp(t);

  function handler(req, reply) {
    reply.send({ ip: req.ip });
  }
  fastify.get('/api/echo-ip', handler);

  return fastify;
}

// Who the trusted proxy is comes from TRUSTED_PROXY_IPS and decides whether req.ip is
// the caller's address or a value the caller wrote into X-Forwarded-For. Since the rate
// limiter keys on req.ip, getting this wrong lets the limit be bypassed by rotating the
// header.
//
// A hop count (the old TRUSTED_PROXY_HOPS form) no longer works: Fastify 5.12.1 started ignoring a
// numeric trustProxy because it cannot validate the immediate peer. A number raises no
// error, it just silently stops trusting anything — and the rate limiter would then key
// every visitor on the edge's IP, a single shared bucket.
describe('trust proxy', () => {
  test('should use the address the edge appended when the proxy is declared', async (t) => {
    withTrustedProxyIps(t, EDGE_IP);
    const fastify = await createAppWithIpEcho(t);

    // The chain reaching the application is "<attacker>, <real ip appended by the edge>".
    const request = {
      method: 'GET',
      url: '/api/echo-ip',
      headers: { 'x-forwarded-for': `9.9.9.9, ${CLIENT_IP}` },
      remoteAddress: EDGE_IP
    };
    const response = await fastify.inject(request);

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, CLIENT_IP);
  });

  test('should accept a CIDR and not only an exact address', async (t) => {
    withTrustedProxyIps(t, '192.0.2.0/24');
    const fastify = await createAppWithIpEcho(t);

    const request = {
      method: 'GET',
      url: '/api/echo-ip',
      headers: { 'x-forwarded-for': `9.9.9.9, ${CLIENT_IP}` },
      remoteAddress: EDGE_IP
    };
    const response = await fastify.inject(request);

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, CLIENT_IP);
  });

  test('should not let the client forge 127.0.0.1 through the declared proxy', async (t) => {
    withTrustedProxyIps(t, EDGE_IP);
    const fastify = await createAppWithIpEcho(t);

    const request = {
      method: 'GET',
      url: '/api/echo-ip',
      headers: { 'x-forwarded-for': `127.0.0.1, ${CLIENT_IP}` },
      remoteAddress: EDGE_IP
    };
    const response = await fastify.inject(request);

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, CLIENT_IP);
  });

  // A peer that is not on the list is not a proxy: its header counts for nothing, even
  // when the variable is filled in with some other address.
  test('should ignore X-Forwarded-For from a peer outside the list', async (t) => {
    withTrustedProxyIps(t, '198.51.100.7');
    const fastify = await createAppWithIpEcho(t);

    const request = {
      method: 'GET',
      url: '/api/echo-ip',
      headers: { 'x-forwarded-for': `9.9.9.9, ${CLIENT_IP}` },
      remoteAddress: EDGE_IP
    };
    const response = await fastify.inject(request);

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, EDGE_IP);
  });

  test('should ignore X-Forwarded-For entirely with no proxy declared', async (t) => {
    withTrustedProxyIps(t, undefined);
    const fastify = await createAppWithIpEcho(t);

    const request = {
      method: 'GET',
      url: '/api/echo-ip',
      headers: { 'x-forwarded-for': `9.9.9.9, ${CLIENT_IP}` },
      remoteAddress: EDGE_IP
    };
    const response = await fastify.inject(request);

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, EDGE_IP);
  });
});
