import fp from 'fastify-plugin';

const healthSchema = {
  schema: {
    hide: true,
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' }
        }
      }
    }
  }
};

/**
 * Liveness check for the Docker HEALTHCHECK, a load balancer or the hosting platform.
 *
 * It answers only `{ status: 'ok' }`: no version, uptime or dependency detail, because the
 * route is public and that detail is reconnaissance for whoever calls it. A project with a
 * database adds its readiness check here (e.g. a `SELECT 1`) and answers 503 when it fails.
 *
 * Mounted outside /api/ on purpose: it is infrastructure, not part of the API contract.
 * It keeps the global rate limit — a probe every few seconds stays far below it, and an
 * exemption would be the one unthrottled route.
 */
async function healthPlugin(fastify) {
  fastify.get('/health', healthSchema, async function getHealth(req, reply) {
    return reply
      .header('Cache-Control', 'no-store')
      .send({ status: 'ok' });
  });
}

export default fp(healthPlugin, {
  name: 'health'
});
