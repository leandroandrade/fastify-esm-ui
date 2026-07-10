import fp from 'fastify-plugin';
import autoLoad from '@fastify/autoload';
import { join } from 'node:path';

async function appPlugin(app, config) {
  await app.register(autoLoad, {
    dir: join(import.meta.dirname, 'plugins')
  });
}

export default fp(appPlugin);
