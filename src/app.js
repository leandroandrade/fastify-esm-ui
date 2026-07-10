import autoLoad from '@fastify/autoload';
import { join } from 'node:path';
import Fastify from 'fastify';

import createConfigs from './configs.js';

async function createApp(customConfigs = {}) {
  const defaultConfigs = createConfigs();
  const app = Fastify({
    ...defaultConfigs,
    ...customConfigs
  });

  await app.register(autoLoad, {
    dir: join(import.meta.dirname, 'core'),
    encapsulate: false,
    maxDepth: 0
  }).register(autoLoad, {
    dir: join(import.meta.dirname, 'business'),
    encapsulate: false,
    maxDepth: 0
  });

  return app;
}

export default createApp;
