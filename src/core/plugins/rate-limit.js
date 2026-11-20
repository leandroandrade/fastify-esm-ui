import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

async function rateLimitPlugin(fastify) {
  function buildErrorResponse(req, context) {
    const err = new Error(`Muitas requisições. Tente novamente em ${context.after}.`);
    err.statusCode = 429;
    err.expose = true;

    return err;
  }

  function logExceeded(req, key) {
    req.log.warn({ key, url: req.url }, 'rate-limit-plugin: limite excedido');
  }

  await fastify.register(rateLimit, {
    global: true,
    // onRequest, not preHandler: @fastify/rate-limit appends its hook to whatever the
    // route already declares for that phase. A route that authenticates in a preHandler
    // therefore answers 401 and returns before the limiter counts the attempt, leaving the
    // credential check as the one unthrottled endpoint in the application.
    hook: 'onRequest',
    max: 100,
    timeWindow: '1 minute',
    // No allowList: `req.ip` is derived from X-Forwarded-For whenever the peer is a trusted
    // proxy, so exempting a literal address lets a client name itself into the exemption.
    //
    // No keyGenerator either: the library groups IPv6 clients by /64 only in its default
    // generator. A custom one keys on the full address, and a subscriber holding a /64 then
    // gets a fresh budget on every request.
    errorResponseBuilder: buildErrorResponse,
    onExceeded: logExceeded
  });

  // Ready-made route options for tighter budgets, spread into a route declaration:
  //   fastify.post('/', { ...fastify.rateLimitStrict, schema }, async function handler() {})
  fastify.decorate('rateLimitStrict', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  });

  fastify.decorate('rateLimitDestrutivo', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour'
      }
    }
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit'
});
