const helloSchema = {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        // Bounded on purpose: the value is echoed back, and an unbounded query string is an
        // invitation to send megabytes into the response and the log.
        name: { type: 'string', minLength: 1, maxLength: 50 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          timestamp: { type: 'string' },
          success: { type: 'boolean' }
        }
      },
      '4xx': {
        $ref: 'error#'
      },
      '5xx': {
        $ref: 'error#'
      }
    }
  }
};

export default async (fastify, opts) => {
  fastify.get('/', helloSchema, async function getHello(req, reply) {
    const name = req.query.name || 'World';

    return reply.send({
      message: `Hello ${name}!`,
      timestamp: new Date().toISOString(),
      success: true
    });
  });
};
