import { test } from 'node:test';
import { withApp } from '../../shared/helper.js';

function toDirectives(header) {
  const directives = new Map();

  for (const part of header.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    directives.set(name, values);
  }

  return directives;
}

// The CSP is the last line of defence against an injection nobody has found yet. With
// 'unsafe-eval' any HTML that reached the page became script through Alpine's evaluator, and
// 'unsafe-inline' let injected markup restyle the page. The CSP build of Alpine needs neither.
test('[core] CSP should allow neither eval nor inline script or style', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/' });
  const directives = toDirectives(res.headers['content-security-policy']);

  t.assert.deepStrictEqual(directives.get('script-src'), ["'self'"]);
  t.assert.deepStrictEqual(directives.get('style-src'), ["'self'"]);
  t.assert.ok(!res.headers['content-security-policy'].includes('unsafe-'), 'no unsafe-* source anywhere');
});

// X-Frame-Options says DENY; frame-ancestors, which modern browsers honour instead, must agree.
test('[core] CSP should forbid framing, matching X-Frame-Options', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/' });
  const directives = toDirectives(res.headers['content-security-policy']);

  t.assert.deepStrictEqual(directives.get('frame-ancestors'), ["'none'"]);
  t.assert.strictEqual(res.headers['x-frame-options'], 'DENY');
});

// Swagger UI injects a <style> at runtime. The exception is scoped to its encapsulated
// context, so the rest of the site keeps the strict policy.
test('[core] CSP should relax inline styles for /docs only', async (t) => {
  const fastify = await withApp(t);

  const docs = await fastify.inject({ method: 'GET', url: '/docs' });
  const docsDirectives = toDirectives(docs.headers['content-security-policy']);

  t.assert.deepStrictEqual(docsDirectives.get('style-src'), ["'self'", "'unsafe-inline'"]);
  t.assert.deepStrictEqual(docsDirectives.get('script-src'), ["'self'"], 'scripts stay strict on /docs too');

  const home = await fastify.inject({ method: 'GET', url: '/' });
  t.assert.deepStrictEqual(toDirectives(home.headers['content-security-policy']).get('style-src'), ["'self'"]);
});
