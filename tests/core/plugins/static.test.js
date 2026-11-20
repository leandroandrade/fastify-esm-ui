import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { withApp } from '../../shared/helper.js';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', '..', '..', 'public');

test('[core] should serve a file under /public/', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/public/js/main.js' });

  t.assert.strictEqual(res.statusCode, 200);
});

// public/ has no dotfiles today; this keeps one added by accident (an editor or OS file,
// a stray .env) from ever being served.
test('[core] should not serve dotfiles under /public/', async (t) => {
  const dotfile = path.join(PUBLIC_DIR, '.static-test');
  await fs.writeFile(dotfile, 'secret');

  async function removeDotfile() {
    await fs.rm(dotfile, { force: true });
  }
  t.after(removeDotfile);

  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/public/.static-test' });

  t.assert.strictEqual(res.statusCode, 404);
});
