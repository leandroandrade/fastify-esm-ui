import { describe, test } from 'node:test';
import { withApp, withTrustedProxyIps } from '../../shared/helper.js';

// Under `inject` the peer is whatever `remoteAddress` says: declaring that address is what
// simulates the deployment with the edge on the list, and any other one simulates a range
// that has changed.
const PEER_IP = '192.0.2.10';
const OTHER_IP = '198.51.100.7';
const FORWARDED_HEADERS = { 'x-forwarded-for': '9.9.9.9, 203.0.113.5' };

function createLogCollector() {
  const lines = [];

  function write(line) {
    lines.push(line);
  }

  return { lines, stream: { write } };
}

function collectorMessages(collector) {
  function toMessage(line) {
    return JSON.parse(line).msg;
  }

  return collector.lines.map(toMessage);
}

function driftWarnings(collector) {
  function isDrift(message) {
    return Boolean(message) && message.includes('peer outside TRUSTED_PROXY_IPS');
  }

  return collectorMessages(collector).filter(isDrift);
}

async function createAppWithCollector(t, collector, level) {
  const customConfigs = {
    logger: {
      level,
      stream: collector.stream
    }
  };
  const fastify = await withApp(t, customConfigs);

  function handler(req, reply) {
    reply.send({ ip: req.ip });
  }
  fastify.get('/api/echo-ip', handler);

  return fastify;
}

function forwardedRequest() {
  return {
    method: 'GET',
    url: '/api/echo-ip',
    headers: FORWARDED_HEADERS,
    remoteAddress: PEER_IP
  };
}

describe('trust-proxy-diagnostic plugin', () => {
  test('should warn when X-Forwarded-For comes from a peer outside the list', async (t) => {
    withTrustedProxyIps(t, OTHER_IP);
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'warn');

    const response = await fastify.inject(forwardedRequest());

    t.assert.strictEqual(response.statusCode, 200);
    t.assert.strictEqual(response.json().ip, PEER_IP);
    t.assert.strictEqual(driftWarnings(collector).length, 1);
  });

  // The broken deployment keeps serving normal traffic: repeating the line on every
  // request would drown the log instead of highlighting the problem.
  test('should warn only once per process', async (t) => {
    withTrustedProxyIps(t, OTHER_IP);
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'warn');

    for (let attempt = 0; attempt < 3; attempt++) {
      await fastify.inject(forwardedRequest());
    }

    t.assert.strictEqual(driftWarnings(collector).length, 1);
  });

  test('should not warn when the peer is on the list', async (t) => {
    withTrustedProxyIps(t, PEER_IP);
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'warn');

    const response = await fastify.inject(forwardedRequest());

    t.assert.strictEqual(response.json().ip, '203.0.113.5');
    t.assert.deepStrictEqual(driftWarnings(collector), []);
  });

  // With no proxy in front and no forwarded header, the direct deployment (docker-compose,
  // `npm start`) is correct as it stands — warning there would be permanent noise.
  test('should not warn when there is no X-Forwarded-For', async (t) => {
    withTrustedProxyIps(t, undefined);
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'warn');

    const request = { method: 'GET', url: '/api/echo-ip', remoteAddress: PEER_IP };
    await fastify.inject(request);

    t.assert.deepStrictEqual(driftWarnings(collector), []);
  });

  test('should not log the peer of every request without the discovery mode', async (t) => {
    withTrustedProxyIps(t, PEER_IP);
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'info');

    await fastify.inject(forwardedRequest());

    function isConnectionPeer(message) {
      return Boolean(message) && message.includes('connection peer');
    }

    t.assert.deepStrictEqual(collectorMessages(collector).filter(isConnectionPeer), []);
  });
});

// Discovery is switched on by an environment variable read by the env plugin, hence the
// separate block, which sets it before the app exists.
describe('trust-proxy-diagnostic plugin with TRUSTED_PROXY_DEBUG', () => {
  test('should log the connection peer so the range can be discovered', async (t) => {
    withTrustedProxyIps(t, PEER_IP);

    const previous = process.env.TRUSTED_PROXY_DEBUG;

    function restoreEnvironment() {
      if (previous === undefined) {
        delete process.env.TRUSTED_PROXY_DEBUG;
        return;
      }

      process.env.TRUSTED_PROXY_DEBUG = previous;
    }
    t.after(restoreEnvironment);

    process.env.TRUSTED_PROXY_DEBUG = 'true';

    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector, 'info');

    await fastify.inject(forwardedRequest());

    function isConnectionPeer(line) {
      return Boolean(line.msg) && line.msg.includes('connection peer');
    }

    function toObject(line) {
      return JSON.parse(line);
    }

    const record = collector.lines.map(toObject).find(isConnectionPeer);

    t.assert.ok(record, 'the discovery mode should log the peer');
    t.assert.strictEqual(record.peer, PEER_IP);
    t.assert.strictEqual(record.forwardedFor, FORWARDED_HEADERS['x-forwarded-for']);
  });
});
