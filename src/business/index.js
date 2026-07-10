import fp from 'fastify-plugin';
import autoLoad from '@fastify/autoload';
import { join } from 'node:path';

async function appPlugin(app, config) {
  await app.register(autoLoad, {
    dir: join(import.meta.dirname, 'decorators')
  }).register(autoLoad, {
    dir: join(import.meta.dirname, 'routes'),
    options: { prefix: 'api' }
  }).register(autoLoad, {
    dir: join(import.meta.dirname, 'repositories')
  }).register(autoLoad, {
    dir: join(import.meta.dirname, 'views')
  });
}

export default fp(appPlugin);
