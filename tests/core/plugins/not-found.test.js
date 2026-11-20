import { test } from 'node:test';
import { buildApp } from '../../shared/helper.js';

test('[core] should return 404 with rate limit headers', async (t) => {
  const fastify = await buildApp();
  t.after(async () => { await fastify.close(); });

  const res = await fastify.inject({
    method: 'GET',
    url: '/api/not-found-route'
  });

  t.assert.strictEqual(res.statusCode, 404);
  t.assert.deepStrictEqual(res.json(), {
    statusCode: 404,
    error: 'Not Found',
    message: 'Sorry, we could not find what you were looking for.'
  });
});

// @fastify/rate-limit attaches itself to routes through onRoute, and the not-found handler
// is not a route — without its own limiter a scanner probing paths was never throttled.
test('[core] should rate limit requests to unknown paths', async (t) => {
  const fastify = await buildApp();
  t.after(async () => { await fastify.close(); });

  const statuses = {};
  for (let attempt = 0; attempt < 120; attempt++) {
    const request = { method: 'GET', url: `/api/probe-${attempt}`, remoteAddress: '203.0.113.9' };
    const res = await fastify.inject(request);
    statuses[res.statusCode] = (statuses[res.statusCode] || 0) + 1;
  }

  t.assert.ok(statuses[429] > 0, 'probing unknown paths should eventually be rate limited');
});
