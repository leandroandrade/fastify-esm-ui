import fp from 'fastify-plugin';

async function defaultSchemas(fastify) {
  const schemaError = {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      error: { type: 'string' },
      message: { type: 'string' },
      code: { type: 'string' }
    }
  };

  fastify.addSchema({
    $id: 'error',
    ...schemaError
  });
}

export default fp(defaultSchemas, { name: 'schema' });
