import path from 'node:path';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Swagger UI injects a <style> element at runtime, which the site-wide CSP (style-src 'self')
// blocks. The relaxation is applied by @fastify/swagger-ui's own onSend hook, which lives in
// the encapsulated /docs context — every other page keeps the strict policy.
function allowInlineStyles(header) {
  function relaxStyleSrc(directive) {
    const isStyleSrc = directive.trim().startsWith('style-src ');

    return isStyleSrc ? `${directive.trim()} 'unsafe-inline'` : directive;
  }

  return header.split(';').map(relaxStyleSrc).join(';');
}

async function swaggerPlugin(fastify, opts) {
  // With DOCS_ENABLED off neither the spec nor the UI is registered, so /docs is a plain 404
  // — indistinguishable from a route that never existed.
  if (!fastify.config.DOCS_ENABLED) {
    fastify.log.info('swagger-plugin: DOCS_ENABLED is off, /docs not registered');

    return;
  }

  await fastify.register(swagger, {
    mode: 'static',
    specification: {
      path: path.join(import.meta.dirname, '..', '..', 'business', 'swagger', 'sample-swagger.yaml')
    }
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    logLevel: 'silent',
    uiConfig: {
      // The default validator badge loads an image from validator.swagger.io, sending the
      // spec URL to a third party and needing an img-src exception.
      validatorUrl: null
    },
    transformStaticCSP: allowInlineStyles
  });
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  dependencies: ['env', 'helmet']
});
