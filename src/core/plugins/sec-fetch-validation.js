import fp from 'fastify-plugin';
import createError from '@fastify/error';

const SecFetchValidationError = createError('SEC_FETCH_VALIDATION_ERROR', 'Request not allowed', 403);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

// Normalized to `scheme://host[:port]` so the default port collapses on both sides of
// every comparison: `http://localhost:80` equals `http://localhost`, `:3000` does not.
function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originFromHeaders(req) {
  return req.headers.origin || req.headers.referer || null;
}

function originFromRequest(req) {
  const host = req.headers.host;
  if (!host) {
    return null;
  }

  return toOrigin(`${req.protocol}://${host}`);
}

async function secFetchValidationPlugin(fastify) {
  const allowedOrigins = fastify.allowedOrigins;

  /**
   * CSRF protection based on the Sec-Fetch headers, registered as a global `onRequest`
   * hook so a request is blocked before body parsing.
   *
   * Acts on every unsafe method on every path, not only `/api/*`: a rule keyed on where a
   * route happens to be mounted is one nobody remembers when adding the next one, and it
   * would leave any state-changing route mounted outside the prefix unprotected. Do not
   * also add it as a `preHandler`.
   *
   * - Safe methods (`GET`, `HEAD`, `OPTIONS`, `TRACE`) always pass.
   * - `same-origin` and `same-site` pass. Note that `same-site` admits any sibling subdomain
   *   of the deployed domain.
   * - `cross-site` passes only when `Origin`/`Referer` is in TRUSTED_ORIGINS.
   * - `none`, absent or unknown require `Origin`/`Referer`, matching the request's own origin
   *   or one in TRUSTED_ORIGINS — otherwise omitting the header would bypass the check.
   *
   * Every block answers the same generic 403: which path fired stays in the log only.
   */
  async function secFetchSiteProtection(req) {
    if (SAFE_METHODS.has(req.method)) {
      return;
    }

    // No exemption for an Authorization header: nothing here verifies one, so any value
    // would switch the check off. A non-browser client that must POST belongs in
    // TRUSTED_ORIGINS, or gets an exemption written next to the code that verifies its token.
    const secFetchSite = req.headers['sec-fetch-site'];
    const requestHost = req.headers.host;

    const isSameSiteRequest = secFetchSite === 'same-origin' || secFetchSite === 'same-site';
    if (isSameSiteRequest) {
      return;
    }

    const originValue = originFromHeaders(req);
    const origin = toOrigin(originValue);

    if (secFetchSite === 'cross-site') {
      if (origin && allowedOrigins.has(origin)) {
        return;
      }

      req.log.warn({ origin, secFetchSite, requestHost }, 'sec-fetch-validation-plugin: cross-site requests not allowed');

      throw new SecFetchValidationError();
    }

    if (!originValue) {
      req.log.warn({ secFetchSite, requestHost }, 'sec-fetch-validation-plugin: missing Origin/Referer');

      throw new SecFetchValidationError();
    }

    if (!origin) {
      req.log.warn({ origin: originValue, secFetchSite, requestHost }, 'sec-fetch-validation-plugin: invalid Origin/Referer');

      throw new SecFetchValidationError();
    }

    if (origin === originFromRequest(req)) {
      return;
    }

    if (allowedOrigins.has(origin)) {
      return;
    }

    req.log.warn({ origin, secFetchSite, requestHost }, 'sec-fetch-validation-plugin: request origin not allowed');

    throw new SecFetchValidationError();
  }

  fastify.decorate('secFetchSiteProtection', secFetchSiteProtection);

  fastify.addHook('onRequest', secFetchSiteProtection);
}

export default fp(secFetchValidationPlugin, {
  name: 'sec-fetch-validation',
  dependencies: ['env']
});
