import { test } from 'node:test';

import { withApp, withEnv } from '../../shared/helper.js';

// The default of PUBLIC_URL, which .env.test does not override.
const PUBLIC_URL = 'http://localhost:3000';

test('[core] should serve the sitemap as XML', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/sitemap.xml' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.headers['content-type'], 'application/xml; charset=utf-8');
  t.assert.strictEqual(res.headers['cache-control'], 'public, max-age=86400');
  t.assert.ok(res.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'should be a well formed document');
});

test('[core] should list every page with an absolute location', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/sitemap.xml' });

  t.assert.ok(res.body.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  t.assert.ok(res.body.includes(`<loc>${PUBLIC_URL}/</loc>`), 'the location should be built from the public URL');
});

// A sitemap that advertises a URL the application does not serve is a crawl error.
test('[core] should only list locations the application serves', async (t) => {
  const fastify = await withApp(t);

  function toLocation(match) {
    return match[1];
  }

  const res = await fastify.inject({ method: 'GET', url: '/sitemap.xml' });
  const locations = [...res.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(toLocation);

  t.assert.ok(locations.length > 0, 'the sitemap should not be empty');

  for (const location of locations) {
    const path = location.slice(PUBLIC_URL.length);
    const page = await fastify.inject({ method: 'GET', url: path });

    t.assert.strictEqual(page.statusCode, 200, `${path} should be reachable`);
  }
});

test('[core] should escape the public URL inside the XML', async (t) => {
  withEnv(t, 'PUBLIC_URL', 'https://example.test/?a=1&b=<2>');
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/sitemap.xml' });

  t.assert.ok(res.body.includes('<loc>https://example.test/?a=1&amp;b=&lt;2&gt;/</loc>'));
  t.assert.ok(!res.body.includes('&b=<2>'), 'a raw ampersand or bracket would break the document');
});
