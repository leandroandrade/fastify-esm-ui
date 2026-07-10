import { test } from 'node:test';
import { buildApp } from '../../shared/helper.js';

test('should return sample response', async (t) => {
  const fastify = await buildApp();
  t.after(async () => { await fastify.close(); });

  const response = await fastify.inject({
    method: 'GET',
    url: '/docs'
  });

  t.assert.strictEqual(response.statusCode, 200);
  t.assert.deepStrictEqual(typeof response.payload, 'string');
});
