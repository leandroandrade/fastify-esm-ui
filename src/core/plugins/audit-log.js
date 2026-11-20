import fp from 'fastify-plugin';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Only scheme, host and path: a query string can carry tokens, e-mails or search terms, and
// an audit trail must not become a second copy of them.
function withoutQuery(value) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    return `${url.origin}${url.pathname}`;
  } catch {
    return 'invalid';
  }
}

function pathWithoutQuery(url) {
  const queryStart = url.indexOf('?');

  return queryStart === -1 ? url : url.slice(0, queryStart);
}

/**
 * One log line per state-changing request, written when the response is sent — including
 * the ones sec-fetch-validation or the rate limiter refused, which are exactly the attempts
 * worth keeping. Request logging is off globally (see LogController in src/configs.js), so
 * without this a mutation leaves no trace unless its handler logs one.
 *
 * Origin, Referer and Sec-Fetch-Site are recorded because they are what the CSRF check
 * decided on: a 403 can be explained afterwards from this line alone. The request id
 * (`reqId`, from x-correlation-id when valid) is added by the request logger.
 */
async function auditLogPlugin(fastify) {
  async function auditMutation(req, reply) {
    if (!MUTATING_METHODS.has(req.method)) {
      return;
    }

    const entry = {
      method: req.method,
      path: pathWithoutQuery(req.url),
      route: req.routeOptions.url,
      statusCode: reply.statusCode,
      ip: req.ip,
      origin: withoutQuery(req.headers.origin),
      referer: withoutQuery(req.headers.referer),
      secFetchSite: req.headers['sec-fetch-site'],
      responseTimeMs: Math.round(reply.elapsedTime)
    };

    // Set by an authentication plugin, when the project has one.
    if (req.user?.sub) {
      entry.user = req.user.sub;
    }

    req.log.info({ audit: entry }, 'audit-log-plugin: mutating request');
  }

  fastify.addHook('onResponse', auditMutation);
}

export default fp(auditLogPlugin, {
  name: 'audit-log'
});
