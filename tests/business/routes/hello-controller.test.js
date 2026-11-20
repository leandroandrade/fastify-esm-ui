import { test } from 'node:test';
import { withApp } from '../../shared/helper.js';

test('should greet World when no name is given', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/api/hello' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.json().message, 'Hello World!');
  t.assert.strictEqual(res.json().success, true);
});

test('should greet the given name', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: '/api/hello?name=Ana' });

  t.assert.strictEqual(res.statusCode, 200);
  t.assert.strictEqual(res.json().message, 'Hello Ana!');
});

// The sanitize hook runs in preValidation, so invisible characters are gone before the
// schema and the handler see the value.
test('should greet with the sanitized name', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: `/api/hello?name=${encodeURIComponent('A​na')}` });

  t.assert.strictEqual(res.json().message, 'Hello Ana!');
});

test('should reject a name longer than 50 characters', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: `/api/hello?name=${'a'.repeat(51)}` });

  t.assert.strictEqual(res.statusCode, 400);
  t.assert.strictEqual(res.json().message, 'Dados de entrada inválidos.');
});

// A name of nothing but invisible characters is empty once cleaned, so minLength rejects it
// instead of greeting nobody.
test('should reject a name made only of invisible characters', async (t) => {
  const fastify = await withApp(t);

  const res = await fastify.inject({ method: 'GET', url: `/api/hello?name=${encodeURIComponent('​‍')}` });

  t.assert.strictEqual(res.statusCode, 400);
});
