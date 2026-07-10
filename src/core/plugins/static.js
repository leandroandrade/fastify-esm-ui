import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

async function staticPlugin(fastify, opts) {
  await fastify.register(fastifyStatic, {
    root: path.join(import.meta.dirname, '..', '..', '..', 'public'),
    prefix: '/public/'
  });
}

export default fp(staticPlugin, {
  name: 'static'
});
