import { test } from 'node:test';
import { withApp } from '../../shared/helper.js';

test('[core] health should answer ok without caching', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/health' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.headers['cache-control'], 'no-store');
  t.assert.deepStrictEqual(res.json(), { status: 'ok' });
});

// The route is public: anything beyond the status (version, uptime, dependency names) is
// reconnaissance for whoever calls it.
test('[core] health should expose nothing but the status', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/health' });

  t.assert.deepStrictEqual(Object.keys(res.json()), ['status']);
});

test('[core] health should answer HEAD for probes that use it', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'HEAD', url: '/health' });

  t.assert.strictEqual(res.statusCode, 200);
});
