import fp from 'fastify-plugin';
import fastifyFormbody from '@fastify/formbody';

async function formbodyPlugin(fastify, opts) {
  await fastify.register(fastifyFormbody);
}

export default fp(formbodyPlugin, {
  name: 'formbody'
});
