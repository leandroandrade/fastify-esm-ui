import fp from 'fastify-plugin';

async function apiRequestPlugin(fastify) {
  function isApiRequest(req) {
    return req.url.startsWith('/api/');
  }

  fastify.decorate('isApiRequest', isApiRequest);
}

export default fp(apiRequestPlugin, {
  name: 'api-request'
});
