import { test } from 'node:test';
import { withApp, withEnv } from '../../shared/helper.js';

test('should serve the API documentation when DOCS_ENABLED is on', async (t) => {
  withEnv(t, 'DOCS_ENABLED', 'true');
  const fastify = await withApp(t);

  const response = await fastify.inject({ method: 'GET', url: '/docs' });

  t.assert.strictEqual(response.statusCode, 200);
  t.assert.strictEqual(typeof response.payload, 'string');

  const home = await fastify.inject({ method: 'GET', url: '/' });
  t.assert.ok(home.body.includes('href="/docs"'), 'the pages should link to the documentation');
});

// Off is the default, so a production deployment that never heard of the variable does not
// publish its API map.
test('should not register /docs when DOCS_ENABLED is unset', async (t) => {
  withEnv(t, 'DOCS_ENABLED', undefined);
  const fastify = await withApp(t);

  const docs = await fastify.inject({ method: 'GET', url: '/docs' });
  t.assert.strictEqual(docs.statusCode, 404);

  const spec = await fastify.inject({ method: 'GET', url: '/docs/json' });
  t.assert.strictEqual(spec.statusCode, 404, 'the raw specification must not be reachable either');

  const home = await fastify.inject({ method: 'GET', url: '/' });
  t.assert.ok(!home.body.includes('href="/docs"'), 'no page should link to a route that does not exist');
});
