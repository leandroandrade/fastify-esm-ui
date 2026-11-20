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

      // Empty by default: a development origin left as the fallback would be trusted by any
      // deployment that forgot the variable. Local values live in .env and .env.test.
      TRUSTED_ORIGINS: { type: 'string', default: '' },

      // Origin the site is served from. Canonical links, Open Graph tags, robots.txt and
      // sitemap.xml are all built from it, so production must set it.
      PUBLIC_URL: { type: 'string', default: 'http://localhost:3000' },

      // Logs the TCP peer of every request, to discover the proxy range that goes into
      // TRUSTED_PROXY_IPS (read in src/configs.js). See trust-proxy-diagnostic.js.
      TRUSTED_PROXY_DEBUG: { type: 'boolean', default: false },

      // Swagger UI at /docs. Off by default: the API map is useful in development and an
      // inventory of the attack surface in production. .env.example and .env.test turn it on.
      DOCS_ENABLED: { type: 'boolean', default: false },

      // Commit of the running build, shown in the footer. The Dockerfile receives it as the
      // GIT_COMMIT_HASH build argument.
      GIT_COMMIT_HASH: { type: 'string', default: 'dev' }
    }
  };

  await fastify.register(fastifyEnv, {
    schema
  });

  const allowedOrigins = new Set(parseOrigins(fastify.config.TRUSTED_ORIGINS));
  fastify.decorate('allowedOrigins', allowedOrigins);

  const publicUrl = fastify.config.PUBLIC_URL.replace(/\/+$/, '');
  fastify.decorate('publicUrl', publicUrl);
}

export default fp(envPlugin, {
  name: 'env'
});
