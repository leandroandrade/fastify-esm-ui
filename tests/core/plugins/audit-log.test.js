import { describe, test } from 'node:test';
import { withApp } from '../../shared/helper.js';

const JSON_BODY = { 'content-type': 'application/json' };

function createLogCollector() {
  const lines = [];

  function write(line) {
    lines.push(line);
  }

  return { lines, stream: { write } };
}

function auditEntries(collector) {
  function toRecord(line) {
    return JSON.parse(line);
  }

  function isAudit(record) {
    return record.msg === 'audit-log-plugin: mutating request';
  }

  return collector.lines.map(toRecord).filter(isAudit);
}

async function createAppWithCollector(t, collector) {
  const customConfigs = {
    logger: {
      level: 'info',
      stream: collector.stream
    }
  };
  const fastify = await withApp(t, customConfigs);

  function handler(req, reply) {
    reply.code(201).send({ created: true });
  }
  fastify.post('/api/resources', handler);
  fastify.get('/api/resources', handler);

  return fastify;
}

describe('audit-log plugin', () => {
  test('should record a mutating request with what the CSRF check decided on', async (t) => {
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector);

    const request = {
      method: 'POST',
      url: '/api/resources?token=secret-value',
      headers: {
        ...JSON_BODY,
        'sec-fetch-site': 'same-origin',
        origin: 'http://localhost',
        referer: 'http://localhost/form?email=someone@example.test',
        'x-correlation-id': 'audit-test-0001'
      },
      body: {}
    };
    const res = await fastify.inject(request);

    t.assert.strictEqual(res.statusCode, 201);

    const [entry] = auditEntries(collector);
    t.assert.ok(entry, 'the mutation should be audited');
    t.assert.strictEqual(entry.reqId, 'audit-test-0001', 'the line should carry the correlation id');
    t.assert.strictEqual(entry.audit.method, 'POST');
    t.assert.strictEqual(entry.audit.path, '/api/resources');
    t.assert.strictEqual(entry.audit.route, '/api/resources');
    t.assert.strictEqual(entry.audit.statusCode, 201);
    t.assert.strictEqual(entry.audit.origin, 'http://localhost/');
    t.assert.strictEqual(entry.audit.referer, 'http://localhost/form');
    t.assert.strictEqual(entry.audit.secFetchSite, 'same-origin');
    t.assert.strictEqual(typeof entry.audit.responseTimeMs, 'number');
  });

  // A query string can carry tokens or personal data; the audit trail must not copy them.
  test('should drop the query string from the path and the referer', async (t) => {
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector);

    await fastify.inject({
      method: 'POST',
      url: '/api/resources?token=secret-value',
      headers: { ...JSON_BODY, 'sec-fetch-site': 'same-origin', referer: 'http://localhost/form?email=someone@example.test' },
      body: {}
    });

    const raw = collector.lines.join('');
    t.assert.doesNotMatch(raw, /secret-value/);
    t.assert.doesNotMatch(raw, /someone@example\.test/);
  });

  // The refused attempts are the ones worth keeping: a CSRF block is audited with its 403.
  test('should record a request the CSRF check refused', async (t) => {
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector);

    const res = await fastify.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { ...JSON_BODY, 'sec-fetch-site': 'cross-site', origin: 'http://evil.test' },
      body: {}
    });

    t.assert.strictEqual(res.statusCode, 403);

    const [entry] = auditEntries(collector);
    t.assert.strictEqual(entry.audit.statusCode, 403);
    t.assert.strictEqual(entry.audit.origin, 'http://evil.test/');
    t.assert.strictEqual(entry.audit.secFetchSite, 'cross-site');
  });

  test('should mark an origin that is not a URL instead of logging it raw', async (t) => {
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector);

    await fastify.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { ...JSON_BODY, origin: 'not a url\nfake log line' },
      body: {}
    });

    const [entry] = auditEntries(collector);
    t.assert.strictEqual(entry.audit.origin, 'invalid');
  });

  test('should not audit safe methods', async (t) => {
    const collector = createLogCollector();
    const fastify = await createAppWithCollector(t, collector);

    await fastify.inject({ method: 'GET', url: '/api/resources' });

    t.assert.deepStrictEqual(auditEntries(collector), []);
  });
});
