import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { LogController } from 'fastify';

// Accepted as the request id only when it looks like an id: anything else (a 10 KB string,
// a newline, a value shaped like a log line) would be copied into every log of the request.
const CORRELATION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

function isEntryValid(entry) {
  const parts = entry.split('/');
  if (parts.length > 2) {
    return false;
  }

  const version = isIP(parts[0]);
  if (version === 0) {
    return false;
  }

  const prefix = parts[1];
  if (prefix === undefined) {
    return true;
  }

  const bits = Number(prefix);
  const maximumBits = version === 4 ? 32 : 128;

  return prefix !== '' && Number.isInteger(bits) && bits >= 0 && bits <= maximumBits;
}

// The rate limiter keys on `req.ip`, and the trusted proxy is what decides whether that
// value is the caller or a value the caller picked. Who to trust belongs to the deployment,
// not to the code: behind a load balancer/edge declare its address range, while
// docker-compose and a bare `npm start` publish the port directly and must trust nothing.
// Absent means trusting nobody and keying on the socket address — over-restrictive at
// worst, never bypassable.
//
// The numeric form (a hop count) was disabled in Fastify 5.12.1: it cannot validate the
// immediate peer, so a direct client forged the header by sending enough hops. Passing a
// number today is silently ignored, which is why this variable takes addresses/CIDRs and
// refuses anything else at boot.
//
// Never use `trustProxy: true`: trusting everything, Fastify takes the left end of
// X-Forwarded-For — exactly the part the client writes.
function toTrustProxy() {
  const raw = process.env.TRUSTED_PROXY_IPS;
  if (raw === undefined || raw.trim() === '') {
    return false;
  }

  function normalize(entry) {
    return entry.trim();
  }

  function isInvalid(entry) {
    return !isEntryValid(entry);
  }

  const entries = raw.split(',').map(normalize);
  const invalid = entries.filter(isInvalid);
  if (invalid.length > 0) {
    throw new Error(`TRUSTED_PROXY_IPS takes addresses or CIDRs separated by commas, received "${invalid.join(', ')}"`);
  }

  return entries;
}

/**
 * @returns {import('fastify').FastifyServerOptions} Instance of Fastify
 */
function createConfigs() {
  return {
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: toTrustProxy(),
    logger: {
      // A deployment that forgets LOG_LEVEL must not run with development verbosity.
      level: process.env.LOG_LEVEL || 'info'
    },
    genReqId(req) {
      const recebido = req.headers['x-correlation-id'];
      if (typeof recebido === 'string' && CORRELATION_ID_RE.test(recebido)) {
        return recebido;
      }

      return randomUUID();
    },
    ajv: {
      customOptions: {
        removeAdditional: 'all',   // Remove extra properties
        useDefaults: true,         // Apply default values
        coerceTypes: 'array',      // Coerce types (including scalar → array)
        allErrors: true            // Report all errors, not just first
      }
    },
    routerOptions: {
      ignoreTrailingSlash: true
    },
    // 1 MiB (Fastify's own default), stated explicitly so it is a decision and not an
    // accident. A route that receives uploads raises it for itself with `bodyLimit` in its
    // route options instead of raising it for every route.
    bodyLimit: 1024 * 1024,

    connectionTimeout: 120000,

    // 1 minute: suitable for most payloads, including moderate file uploads
    requestTimeout: 60000,

    // 10 seconds: ensures efficient resource usage for idle connections
    keepAliveTimeout: 10000,

    http: {
      // 15 seconds: prevents slow clients from holding connections too long
      headersTimeout: 15000
    },
    pluginTimeout: 90000
  };
}

export default createConfigs;
