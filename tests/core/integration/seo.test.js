import { test } from 'node:test';

import { withApp, withEnv } from '../../shared/helper.js';

// The default of PUBLIC_URL, which .env.test does not override.
const PUBLIC_URL = 'http://localhost:3000';

async function fetchPage(t, url = '/') {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url });
  t.assert.strictEqual(res.statusCode, 200);

  return res.body;
}

function readStructuredData(t, body) {
  const match = body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  t.assert.ok(match, 'the page should carry a JSON-LD block');

  return JSON.parse(match[1]);
}

test('should carry a canonical link built from the public URL', async (t) => {
  const body = await fetchPage(t);

  t.assert.ok(body.includes(`<link rel="canonical" href="${PUBLIC_URL}/">`));
});

// Without this, every query string anyone ever shared becomes a separate indexed URL.
test('should keep the canonical unchanged for a query string', async (t) => {
  const body = await fetchPage(t, '/?utm_source=newsletter');

  t.assert.ok(body.includes(`<link rel="canonical" href="${PUBLIC_URL}/">`));
});

test('should carry the title, description and Open Graph tags', async (t) => {
  const body = await fetchPage(t);

  t.assert.ok(body.includes('<title>Fastify ESM | REST API Template</title>'));
  t.assert.ok(body.includes('<meta name="description" content="Template para aplicações REST'));
  t.assert.ok(body.includes('<meta name="robots" content="index, follow">'));
  t.assert.ok(body.includes('<meta property="og:type" content="website">'));
  t.assert.ok(body.includes('<meta property="og:site_name" content="Fastify ESM">'));
  t.assert.ok(body.includes('<meta property="og:title" content="Fastify ESM | REST API Template">'));
  t.assert.ok(body.includes(`<meta property="og:url" content="${PUBLIC_URL}/">`));
});

// Every consumer fetches the image out of band, so a relative path would 404 for them.
test('should carry an absolute Open Graph image and a large Twitter card', async (t) => {
  const body = await fetchPage(t);

  t.assert.ok(body.includes(`<meta property="og:image" content="${PUBLIC_URL}/public/assets/og-image.png">`));
  t.assert.ok(body.includes('<meta property="og:image:width" content="1200">'));
  t.assert.ok(body.includes('<meta property="og:image:height" content="630">'));
  t.assert.ok(body.includes('<meta name="twitter:card" content="summary_large_image">'));
  t.assert.ok(body.includes(`<meta name="twitter:image" content="${PUBLIC_URL}/public/assets/og-image.png">`));
});

test('should serve the Open Graph image the pages advertise', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/public/assets/og-image.png' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.headers['content-type'], 'image/png');
});

test('should embed valid WebSite structured data', async (t) => {
  const body = await fetchPage(t);

  // Parsed rather than substring-matched: a block that does not parse is invisible to every
  // consumer of it.
  const data = readStructuredData(t, body);

  t.assert.strictEqual(data['@type'], 'WebSite');
  t.assert.strictEqual(data.name, 'Fastify ESM');
  t.assert.strictEqual(data.url, `${PUBLIC_URL}/`);
});

// The HTML tokenizer ends a script element at the literal `</script`, whatever the element's
// type. PUBLIC_URL is the only non-constant value in the block, so it is what would carry a
// breakout.
test('should escape angle brackets in the structured data', async (t) => {
  const hostile = 'https://example.test/</script><img src=x onerror=alert(1)>';
  withEnv(t, 'PUBLIC_URL', hostile);

  const body = await fetchPage(t);

  t.assert.ok(!body.includes('</script><img'), 'nothing should be able to close the block early');

  const data = readStructuredData(t, body);
  t.assert.strictEqual(data.url, `${hostile}/`, 'the escape should round trip through JSON.parse');
});

test('should keep error pages out of the index', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/does-not-exist' });

  t.assert.strictEqual(res.statusCode, 404);
  t.assert.ok(res.body.includes('<meta name="robots" content="noindex, nofollow">'));
});

test('should mark the current page in the navigation', async (t) => {
  const body = await fetchPage(t);

  t.assert.ok(body.includes('aria-current="page"'), 'the home link should be marked as the current page');
});
