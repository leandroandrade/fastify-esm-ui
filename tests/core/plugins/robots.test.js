import { test } from 'node:test';

import { withApp, withEnv } from '../../shared/helper.js';

test('[core] should serve robots.txt as plain text', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/robots.txt' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.headers['content-type'], 'text/plain; charset=utf-8');
  t.assert.ok(res.body.includes('User-agent: *'));
  t.assert.ok(res.body.includes('Allow: /'));
  t.assert.ok(res.body.includes('Disallow: /api/'), 'the JSON API is not content for a crawler');
});

// The directive is absolute by specification, so it is built from PUBLIC_URL — a derived
// project must never announce the template's host.
test('[core] should point crawlers at the sitemap of the configured public URL', async (t) => {
  withEnv(t, 'PUBLIC_URL', 'https://example.test/');
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/robots.txt' });

  t.assert.ok(
    res.body.includes('Sitemap: https://example.test/sitemap.xml'),
    'robots.txt should announce the sitemap at the public URL, with the trailing slash folded'
  );
});

// @fastify/static is mounted at /public/, so a file left in public/ would only be reachable
// at /public/robots.txt, which no crawler looks at.
test('[core] should serve robots.txt from the root, not from /public', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/public/robots.txt' });

  t.assert.strictEqual(res.statusCode, 404);
});
