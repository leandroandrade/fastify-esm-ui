import { describe, test } from 'node:test';
import { withApp } from '../../shared/helper.js';

const JSON_BODY = { 'content-type': 'application/json' };

// @fastify/env reads process.env when the app is built, so the value has to be in place
// before withApp and put back afterwards. `undefined` removes it.
function withTrustedOrigins(t, origins) {
  const previous = process.env.TRUSTED_ORIGINS;

  function restoreEnvironment() {
    if (previous === undefined) {
      delete process.env.TRUSTED_ORIGINS;
      return;
    }

    process.env.TRUSTED_ORIGINS = previous;
  }
  t.after(restoreEnvironment);

  if (origins === undefined) {
    delete process.env.TRUSTED_ORIGINS;
    return;
  }

  process.env.TRUSTED_ORIGINS = origins;
}

// Every case registers the routes it needs on a real app instance, so the whole hook chain
// (sanitize, rate limit, error handler) runs as it does in production.
async function createAppWithTestRoute(t) {
  const fastify = await withApp(t);

  const handler = (req, reply) => {
    reply.send({ ok: true });
  };

  fastify.get('/api/test-route', handler);
  fastify.post('/api/test-route', handler);

  return fastify;
}

describe('sec-fetch-validation plugin', () => {
  test('safe methods always pass without sec-fetch headers', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const getResponse = await fastify.inject({
      method: 'GET',
      url: '/api/test-route'
    });
    t.assert.strictEqual(getResponse.statusCode, 200);

    const headResponse = await fastify.inject({
      method: 'HEAD',
      url: '/api/test-route'
    });
    t.assert.strictEqual(headResponse.statusCode, 200);
  });

  test('same-origin allowed on POST', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'same-origin',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('same-site allowed on POST', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'same-site',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('cross-site with an allowed origin passes', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('cross-site with a disallowed origin returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'http://evil.com',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('cross-site without origin or referer returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'cross-site',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('absent sec-fetch-site with an origin matching the request host passes', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        origin: 'http://localhost',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('an origin matching host and port passes even when not in the allowed list', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        host: 'app.internal:8443',
        origin: 'http://app.internal:8443',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('an origin on the same host but a different port returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        host: 'app.internal:8443',
        origin: 'http://app.internal:9999',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('absent sec-fetch-site without origin or referer returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('referer is the fallback when origin is absent', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        referer: 'http://localhost/some-path',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('an invalid origin URL returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        origin: 'not-a-url',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('an origin that mismatches the host and is not allowed returns 403', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        origin: 'http://evil.com',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });

  test('sec-fetch-site none with an allowed origin passes', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'none',
        origin: 'http://localhost:3000',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('a blocked request returns 403 with a generic message', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'http://evil.com',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);

    const body = response.json();
    t.assert.strictEqual(body.statusCode, 403);
    t.assert.strictEqual(body.error, 'Forbidden');
    t.assert.strictEqual(body.message, 'Request not allowed');
    // `code` names the control that fired, never the reason: which block path ran stays
    // invisible to the client.
    t.assert.strictEqual(body.code, 'SEC_FETCH_VALIDATION_ERROR');
  });

  test('different block reasons return an identical generic response', async (t) => {
    const fastify = await createAppWithTestRoute(t);

    const baseRequest = {
      method: 'POST',
      url: '/api/test-route',
      headers: JSON_BODY,
      body: {}
    };

    const crossSite = await fastify.inject({
      ...baseRequest,
      headers: { ...baseRequest.headers, 'sec-fetch-site': 'cross-site', origin: 'http://evil.com' }
    });

    const missingOrigin = await fastify.inject({
      ...baseRequest,
      headers: { ...baseRequest.headers, 'sec-fetch-site': 'none' }
    });

    const invalidOrigin = await fastify.inject({
      ...baseRequest,
      headers: { ...baseRequest.headers, 'sec-fetch-site': 'none', origin: 'not-a-url' }
    });

    const notAllowed = await fastify.inject({
      ...baseRequest,
      headers: { ...baseRequest.headers, 'sec-fetch-site': 'none', origin: 'http://evil.com' }
    });

    const expected = {
      statusCode: 403,
      error: 'Forbidden',
      message: 'Request not allowed',
      code: 'SEC_FETCH_VALIDATION_ERROR'
    };
    t.assert.deepStrictEqual(crossSite.json(), expected);
    t.assert.deepStrictEqual(missingOrigin.json(), expected);
    t.assert.deepStrictEqual(invalidOrigin.json(), expected);
    t.assert.deepStrictEqual(notAllowed.json(), expected);
  });

  test('the global hook guards a mutating /api route with no per-route preHandler', async (t) => {
    const fastify = await withApp(t);

    const handler = (req, reply) => {
      reply.code(201).send({ created: true });
    };
    fastify.post('/api/resources', handler);

    const blocked = await fastify.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { 'sec-fetch-site': 'cross-site', origin: 'http://evil.com', ...JSON_BODY },
      body: {}
    });
    t.assert.strictEqual(blocked.statusCode, 403);
    t.assert.strictEqual(blocked.json().error, 'Forbidden');

    const allowed = await fastify.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { 'sec-fetch-site': 'same-origin', ...JSON_BODY },
      body: {}
    });
    t.assert.strictEqual(allowed.statusCode, 201);
  });

  // This used to assert the opposite. The prefix rule left any state-changing route mounted
  // outside /api/ with no CSRF check at all — a rule keyed on where a route sits is one
  // nobody remembers when adding the next one.
  test('the hook validates routes outside /api/ too — a cross-site POST is blocked', async (t) => {
    const fastify = await withApp(t);
    const handler = (req, reply) => {
      reply.send({ ok: true });
    };
    fastify.post('/outside-the-api', handler);

    const response = await fastify.inject({
      method: 'POST',
      url: '/outside-the-api',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'http://evil.com',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
    t.assert.strictEqual(response.json().code, 'SEC_FETCH_VALIDATION_ERROR');
  });

  test('a same-origin POST outside /api/ still passes', async (t) => {
    const fastify = await withApp(t);
    const handler = (req, reply) => {
      reply.send({ ok: true });
    };
    fastify.post('/outside-the-api', handler);

    const response = await fastify.inject({
      method: 'POST',
      url: '/outside-the-api',
      headers: {
        'sec-fetch-site': 'same-origin',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  test('GET outside /api/ is untouched', async (t) => {
    const fastify = await withApp(t);

    const response = await fastify.inject({
      method: 'GET',
      url: '/',
      headers: { 'sec-fetch-site': 'cross-site', origin: 'http://evil.com' }
    });

    t.assert.strictEqual(response.statusCode, 200);
  });

  // The header used to exempt the request outright, without anything ever verifying it — an
  // arbitrary value turned the whole check off. With no authentication in the application a
  // non-browser client that must POST belongs in TRUSTED_ORIGINS instead.
  test('an Authorization header does not exempt a request that carries no origin', async (t) => {
    const fastify = await withApp(t);
    const handler = (req, reply) => {
      reply.send({ ok: true });
    };
    fastify.post('/outside-the-api', handler);

    const withoutToken = await fastify.inject({
      method: 'POST',
      url: '/outside-the-api',
      headers: JSON_BODY,
      body: {}
    });
    t.assert.strictEqual(withoutToken.statusCode, 403, 'a headerless POST is still blocked');

    const withToken = await fastify.inject({
      method: 'POST',
      url: '/outside-the-api',
      headers: { authorization: 'Bearer some-token', ...JSON_BODY },
      body: {}
    });
    t.assert.strictEqual(withToken.statusCode, 403, 'an unverified token should not lift the check');
  });

  // A development origin must never be trusted by default: a deployment that forgets the
  // variable would otherwise accept unsafe requests from any page served at localhost:3000.
  test('trusts no cross-site origin when TRUSTED_ORIGINS is unset', async (t) => {
    withTrustedOrigins(t, undefined);
    const fastify = await createAppWithTestRoute(t);

    t.assert.strictEqual(fastify.allowedOrigins.size, 0);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/test-route',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'http://localhost:3000',
        ...JSON_BODY
      },
      body: {}
    });

    t.assert.strictEqual(response.statusCode, 403);
  });
});
