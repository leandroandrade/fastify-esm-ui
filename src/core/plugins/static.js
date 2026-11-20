import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

async function staticPlugin(fastify, opts) {
  await fastify.register(fastifyStatic, {
    root: path.join(import.meta.dirname, '..', '..', '..', 'public'),
    prefix: '/public/',
    // `ignore` answers 404, as if the file did not exist; `deny` would confirm it with a 403.
    dotfiles: 'ignore'
  });
}

export default fp(staticPlugin, {
  name: 'static'
});
