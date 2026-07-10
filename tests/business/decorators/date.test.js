import Fastify from 'fastify';
import { test } from 'node:test';

import dateDecorator from '../../../src/business/decorators/date.js';

test('should format date with locale string', async (t) => {
  const fastify = Fastify();
  t.after(async () => { await fastify.close(); });

  await fastify.register(dateDecorator);
  t.assert.strictEqual(fastify.dateFormat.toLocaleDate(new Date(2022, 10, 25)), 'November 25, 2022');
});
