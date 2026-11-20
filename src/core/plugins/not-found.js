import fp from 'fastify-plugin';

async function notfoundPlugin(fastify) {
  // @fastify/rate-limit attaches itself through onRoute and this handler is not a route, so
  // it needs a limiter of its own — otherwise probing unknown paths is never throttled.
  const options = { preHandler: fastify.rateLimit() };

  fastify.setNotFoundHandler(options, (req, reply) => {
    const obj = {
      method: req.method,
      url: req.url
    };

    if (req.params) {
      obj.params = req.params;
    }

    if (req.query) {
      obj.query = req.query;
    }

    req.log.warn({ obj }, 'not-found-plugin: route not found');

    if (fastify.isApiRequest(req)) {
      return fastify.httpErrors.notFound('Sorry, we could not find what you were looking for.');
    }

    if (typeof reply.view === 'function') {
      return reply.status(404).view('404.ejs');
    }

    return fastify.httpErrors.notFound('Sorry, we could not find what you were looking for.');
  });
}

export default fp(notfoundPlugin, {
  name: 'not-found',
  dependencies: ['env', 'view', 'api-request', 'rate-limit']
});
