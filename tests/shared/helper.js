import createApp from '../../src/app.js';

async function buildApp(customConfigs = { logger: false }) {
  return await createApp(customConfigs);
}

export {
  buildApp
};
