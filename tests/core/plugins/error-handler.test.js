import Fastify from 'fastify';
import { test } from 'node:test';
import createError from '@fastify/error';

import sensiblePlugin from '../../../src/core/plugins/sensible.js';
import apiRequestPlugin from '../../../src/core/plugins/api-request.js';
import errorHandler from '../../../src/core/plugins/error-handler.js';

async function createApp(t) {
  const fastify = Fastify();
  t.after(async () => {
    await fastify.close();
  });

  await fastify.register(sensiblePlugin);
  await fastify.register(apiRequestPlugin);
  await fastify.register(errorHandler);

  return fastify;
}

function internalError(message, code) {
  const err = new Error(message);
  err.code = code;

  return err;
}

test('[core] schema validation errors return generic message', async (t) => {
  const fastify = await createApp(t);

  const schema = {
    params: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          maxLength: 2
        }
      }
    }
  };
  fastify.get('/api/:message', { schema }, async (req, reply) => {
    t.assert.ifError('should not pass here!');
  });

  const response = await fastify.inject({
    method: 'GET',
    url: '/api/hello'
  });

  t.assert.strictEqual(response.statusCode, 400);
  const body = response.json();
  t.assert.strictEqual(body.statusCode, 400);
  t.assert.strictEqual(body.error, 'Bad Request');
  t.assert.strictEqual(body.message, 'Dados de entrada inválidos.');
  t.assert.strictEqual(body.code, 'FST_ERR_VALIDATION');
});

test('should return generic error for untyped 5xx', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    throw new Error('generic error');
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 500);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Sorry, there was an error processing your request.'
  });
});

test('untyped 4xx returns generic message (info-leak protection)', async (t) => {
  class SomeError extends Error {
    constructor(message, statusCode) {
      super(message);

      this.statusCode = statusCode;
    }
  }

  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    throw new SomeError('Custom Error!', 422);
  });

  const response = await fastify.inject('/api/test');
  t.assert.strictEqual(response.statusCode, 422);

  t.assert.deepStrictEqual(response.json(), {
    statusCode: 422,
    error: 'Unprocessable Entity',
    message: 'Requisição inválida.'
  });
});

test('typed 4xx (httpErrors) passes through message', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    return fastify.httpErrors.unprocessableEntity('Custom Error!');
  });

  const response = await fastify.inject('/api/test');
  t.assert.strictEqual(response.statusCode, 422);

  const body = response.json();
  t.assert.strictEqual(body.statusCode, 422);
  t.assert.strictEqual(body.error, 'Unprocessable Entity');
  t.assert.strictEqual(body.message, 'Custom Error!');
});

test('typed 5xx (@fastify/error) passes through message and code', async (t) => {
  const fastify = await createApp(t);

  const DependencyDownError = createError('APP_DEPENDENCY_DOWN', 'Upstream unavailable', 503);
  fastify.get('/api/test', (request, reply) => {
    throw new DependencyDownError();
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 503);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 503,
    error: 'Service Unavailable',
    message: 'Upstream unavailable',
    code: 'APP_DEPENDENCY_DOWN'
  });
});

test('a filesystem error does not leak its path on 5xx', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    throw internalError("ENOENT: no such file or directory, open '/srv/app/.env.production'", 'ENOENT');
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 500);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Sorry, there was an error processing your request.'
  });
  t.assert.doesNotMatch(response.body, /\.env\.production/, 'the filesystem path must not reach the client');
});

test('a sqlite error does not leak the schema on 5xx', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    throw internalError('no such table: main.internal_admin_tokens', 'SQLITE_ERROR');
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 500);
  t.assert.strictEqual(response.json().message, 'Sorry, there was an error processing your request.');
  t.assert.strictEqual(response.json().code, undefined, 'the driver error code must not reach the client');
  t.assert.doesNotMatch(response.body, /internal_admin_tokens/, 'the table name must not reach the client');
});

test('an untyped 4xx carrying an internal code leaks neither message nor code', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    const err = internalError('UNIQUE constraint failed: users.email', 'SQLITE_CONSTRAINT');
    err.statusCode = 409;

    throw err;
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 409);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 409,
    error: 'Conflict',
    message: 'Requisição inválida.'
  });
});

test('an error with a non-error status is answered as 500', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/api/test', (request, reply) => {
    const err = new Error('boom');
    err.statusCode = 200;

    throw err;
  });

  const response = await fastify.inject('/api/test');

  t.assert.strictEqual(response.statusCode, 500);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Sorry, there was an error processing your request.'
  });
});

test('a non-api request without a view engine falls back to a generic json body', async (t) => {
  const fastify = await createApp(t);

  fastify.get('/page', (request, reply) => {
    throw internalError('no such table: main.internal_admin_tokens', 'SQLITE_ERROR');
  });

  const response = await fastify.inject('/page');

  t.assert.strictEqual(response.statusCode, 500);
  t.assert.deepStrictEqual(response.json(), {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Sorry, there was an error processing your request.'
  });
});
