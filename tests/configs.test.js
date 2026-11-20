import { describe, test } from 'node:test';
import { withTrustedProxyIps } from './shared/helper.js';
import createConfigs from '../src/configs.js';

// .env.test sets LOG_LEVEL, so the default is only visible with the variable removed.
function withoutLogLevel(t) {
  const previous = process.env.LOG_LEVEL;

  function restoreEnvironment() {
    if (previous !== undefined) {
      process.env.LOG_LEVEL = previous;
    }
  }
  t.after(restoreEnvironment);

  delete process.env.LOG_LEVEL;
}

describe('configs', () => {
  // A deployment that forgets LOG_LEVEL must not run with development verbosity.
  test('should log at info when LOG_LEVEL is unset', async (t) => {
    withoutLogLevel(t);

    t.assert.strictEqual(createConfigs().logger.level, 'info');
  });

  test('should trust no proxy when no address is configured', async (t) => {
    withTrustedProxyIps(t, undefined);

    t.assert.strictEqual(createConfigs().trustProxy, false);
  });

  test('should trust no proxy when the list is empty', async (t) => {
    withTrustedProxyIps(t, '');

    t.assert.strictEqual(createConfigs().trustProxy, false);
  });

  // false, not an empty array: an empty list would still put Fastify on the
  // X-Forwarded-For path, and skipping it entirely is the behaviour being asked for.
  test('should trust no proxy when the list is only whitespace', async (t) => {
    withTrustedProxyIps(t, '   ');

    t.assert.strictEqual(createConfigs().trustProxy, false);
  });

  test('should pass a single address through', async (t) => {
    withTrustedProxyIps(t, '127.0.0.1');

    t.assert.deepStrictEqual(createConfigs().trustProxy, ['127.0.0.1']);
  });

  test('should accept a CIDR, which is how an edge is declared', async (t) => {
    withTrustedProxyIps(t, '100.64.0.0/10');

    t.assert.deepStrictEqual(createConfigs().trustProxy, ['100.64.0.0/10']);
  });

  test('should accept a comma-separated list and trim each entry', async (t) => {
    withTrustedProxyIps(t, '100.64.0.0/10, 10.0.0.0/8 ,::1');

    t.assert.deepStrictEqual(createConfigs().trustProxy, ['100.64.0.0/10', '10.0.0.0/8', '::1']);
  });

  test('should accept an IPv6 CIDR up to 128 bits', async (t) => {
    withTrustedProxyIps(t, 'fd00::/8');

    t.assert.deepStrictEqual(createConfigs().trustProxy, ['fd00::/8']);
  });

  // A hop count was the valid configuration before Fastify 5.12.1, which now ignores a
  // numeric trustProxy entirely. Refusing it at boot keeps an old deployment from coming
  // up trusting nothing while looking configured.
  test('should refuse a hop count left over from the old configuration', async (t) => {
    withTrustedProxyIps(t, '1');

    t.assert.throws(createConfigs, /TRUSTED_PROXY_IPS/);
  });

  // A typo must not resolve to something plausible: trusting everything on a bad value is
  // a bypass, and silently trusting nobody would mis-limit production without a signal.
  test('should refuse a value that is not an address', async (t) => {
    withTrustedProxyIps(t, 'yes');

    t.assert.throws(createConfigs, /TRUSTED_PROXY_IPS/);
  });

  test('should refuse a CIDR whose prefix is out of range', async (t) => {
    withTrustedProxyIps(t, '10.0.0.0/33');

    t.assert.throws(createConfigs, /TRUSTED_PROXY_IPS/);
  });

  test('should refuse a CIDR with no prefix after the slash', async (t) => {
    withTrustedProxyIps(t, '10.0.0.0/');

    t.assert.throws(createConfigs, /TRUSTED_PROXY_IPS/);
  });

  test('should refuse the whole list when a single entry is invalid', async (t) => {
    withTrustedProxyIps(t, '127.0.0.1, 10.0.0.0/33');

    t.assert.throws(createConfigs, /TRUSTED_PROXY_IPS/);
  });

  test('should reuse a well formed x-correlation-id as the request id', async (t) => {
    const req = { headers: { 'x-correlation-id': 'abc-1234-def' } };

    t.assert.strictEqual(createConfigs().genReqId(req), 'abc-1234-def');
  });

  // The id is copied into every log line of the request, so a value shaped like a log line,
  // or simply huge, must never become it.
  test('should replace a malformed x-correlation-id with a fresh uuid', async (t) => {
    const invalidValues = ['short', 'has space inside', 'line\nbreak-injected', 'x'.repeat(65), ['array-value-1']];

    for (const value of invalidValues) {
      const id = createConfigs().genReqId({ headers: { 'x-correlation-id': value } });

      t.assert.notStrictEqual(id, value);
      t.assert.match(id, /^[0-9a-f-]{36}$/, `expected a uuid for ${JSON.stringify(value)}`);
    }
  });

  test('should generate a uuid when no x-correlation-id is sent', async (t) => {
    const id = createConfigs().genReqId({ headers: {} });

    t.assert.match(id, /^[0-9a-f-]{36}$/);
  });
});
