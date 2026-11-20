import createApp from '../../src/app.js';

export async function buildApp(customConfigs = { logger: false }) {
  return await createApp(customConfigs);
}

// `forceCloseConnections: true` closes in-flight sockets too, not only idle ones. Needed
// whenever a real client (a browser) talks to the app — see tests/shared/e2e-helper.js.
export async function buildRawApp(customConfigs = { logger: false }) {
  const configs = { forceCloseConnections: true, ...customConfigs };

  return await createApp(configs);
}

function fecharApp(app) {
  return app.close();
}

export async function withApp(t, customConfigs) {
  const app = await buildApp(customConfigs);
  t.after(fecharApp.bind(null, app));

  return app;
}

export async function withRawApp(t, customConfigs) {
  const app = await buildRawApp(customConfigs);
  t.after(fecharApp.bind(null, app));

  return app;
}

// Sets an environment variable for one test and puts the previous value back afterwards.
// @fastify/env and createConfigs read process.env when the app is built, so this must run
// before withApp. `undefined` removes the variable.
export function withEnv(t, name, value) {
  const previous = process.env[name];

  function restoreEnvironment() {
    if (previous === undefined) {
      delete process.env[name];
      return;
    }

    process.env[name] = previous;
  }
  t.after(restoreEnvironment);

  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

// `undefined` removes the variable, which is the deployment with no proxy in front of it.
export function withTrustedProxyIps(t, ips) {
  withEnv(t, 'TRUSTED_PROXY_IPS', ips);
}
