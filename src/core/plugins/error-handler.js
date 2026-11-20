import { STATUS_CODES } from 'node:http';
import fp from 'fastify-plugin';

const SCHEMA_VALIDATION_MESSAGE = 'Dados de entrada inválidos.';
const GENERIC_CLIENT_MESSAGE = 'Requisição inválida.';
const GENERIC_SERVER_MESSAGE = 'Sorry, there was an error processing your request.';

// Only an author-declared error carries a message meant for the client: @fastify/error
// (name FastifyError) or http-errors/@fastify/sensible (expose === true). A bare `err.code`
// is not that signal — ENOENT and SQLITE_ERROR carry one, and their messages hold
// filesystem paths and table names.
function isTypedError(err) {
  return err.name === 'FastifyError' || err.expose === true;
}

// A status outside the error ranges is a bug in the thrower, not a successful response.
function toErrorStatusCode(err) {
  const statusCode = err.statusCode || 500;
  const isErrorStatus = statusCode >= 400 && statusCode <= 599;

  return isErrorStatus ? statusCode : 500;
}

function errorPayload(statusCode, message, code) {
  const fallbackError = statusCode <= 499 ? 'Bad Request' : 'Internal Server Error';

  const payload = {
    statusCode,
    error: STATUS_CODES[statusCode] || fallbackError,
    message
  };

  if (code) {
    payload.code = code;
  }

  return payload;
}

async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler((err, req, reply) => {
    const statusCode = toErrorStatusCode(err);
    const isClientError = statusCode <= 499;

    if (isClientError) {
      req.log.warn({ err }, err.message);
    } else {
      req.log.error({ err }, err.message);
    }

    // The raw AJV message can expose internal field names, so a generic one is sent and
    // the detail stays in the log.
    const isSchemaValidationError = Array.isArray(err.validation);
    const isTyped = isSchemaValidationError || isTypedError(err);
    const code = isTyped ? err.code : undefined;

    if (isClientError) {
      let message;
      if (isSchemaValidationError) {
        message = SCHEMA_VALIDATION_MESSAGE;
      } else if (isTyped) {
        message = err.message;
      } else {
        message = GENERIC_CLIENT_MESSAGE;
      }

      return reply.code(statusCode).send(errorPayload(statusCode, message, code));
    }

    if (fastify.isApiRequest(req)) {
      const message = isTyped ? err.message : GENERIC_SERVER_MESSAGE;

      return reply.code(statusCode).send(errorPayload(statusCode, message, code));
    }

    if (typeof reply.view === 'function') {
      return reply.status(statusCode).view('500.ejs');
    }

    return reply.code(statusCode).send(errorPayload(statusCode, GENERIC_SERVER_MESSAGE));
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  dependencies: ['api-request']
});
