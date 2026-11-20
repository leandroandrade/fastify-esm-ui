import { test } from 'node:test';
import { withApp, withEnv } from '../../shared/helper.js';

test('should render the deployed commit sha shortened to 7 chars', async (t) => {
  withEnv(t, 'GIT_COMMIT_HASH', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d');
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.ok(res.body.includes('build <span class="font-mono">1a2b3c4</span>'), 'Footer should show the short sha');
  t.assert.ok(!res.body.includes('1a2b3c4d5e6f'), 'Footer should not show the full sha');
});

test('should render "dev" when no commit sha is injected', async (t) => {
  withEnv(t, 'GIT_COMMIT_HASH', undefined);
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.ok(res.body.includes('build <span class="font-mono">dev</span>'), 'Footer should fall back to "dev"');
});

test('should load only the scripts the view asks for', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/' });

  t.assert.ok(res.body.includes('<script src="/public/js/api-demo.js" defer></script>'), 'the home page script should load');

  const notFound = await fastify.inject({ method: 'GET', url: '/does-not-exist' });
  t.assert.ok(!notFound.body.includes('api-demo.js'), 'a page script must not leak into other pages');
});

// errorMsg reaches the page as a data attribute read by Alpine and written with x-text, so
// EJS escaping is what keeps a hostile message from becoming markup.
test('should escape a server-side error message', async (t) => {
  const fastify = await withApp(t);

  fastify.get('/flash-probe', function flashProbe(req, reply) {
    return reply.view('home', { errorMsg: '"><img src=x onerror=alert(1)>', scripts: ['api-demo.js'] }, { layout: 'layout' });
  });

  const res = await fastify.inject({ method: 'GET', url: '/flash-probe' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.ok(res.body.includes('x-data="flashMessage"'), 'the message should go through the toast stack');
  t.assert.ok(!res.body.includes('<img src=x'), 'the message must not be rendered as markup');
  t.assert.ok(res.body.includes('&#34;&gt;&lt;img src=x onerror=alert(1)&gt;'), 'the message should be HTML-escaped');
});
