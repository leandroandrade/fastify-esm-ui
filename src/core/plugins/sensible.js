import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';

async function sensiblePlugin(fastify, opts) {
  fastify.register(sensible);
}

export default fp(sensiblePlugin);
