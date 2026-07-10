import path from 'node:path';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

async function swaggerPlugin(fastify, opts) {
  fastify.register(swagger, {
    exposeRoute: true,
    mode: 'static',
    specification: {
      path: path.join(import.meta.dirname, '..', '..', 'business', 'swagger', 'sample-swagger.yaml')
    }
  });

  fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    logLevel: 'silent'
  });
}

export default fp(swaggerPlugin);
