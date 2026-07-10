import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

function parseOrigins(value = '') {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function envPlugin(fastify) {
  const schema = {
    type: 'object',
    required: [
    ],
    properties: {
      PORT: { type: 'string', default: 3000 },
      HOST: { type: 'string', default: '0.0.0.0' },
      TRUSTED_ORIGINS: { type: 'string', default: 'http://localhost:3000' }
    }
  };

  await fastify.register(fastifyEnv, {
    schema
  });

  const allowedOrigins = new Set(parseOrigins(fastify.config.TRUSTED_ORIGINS));
  fastify.decorate('allowedOrigins', allowedOrigins);
}

export default fp(envPlugin, {
  name: 'env'
});
