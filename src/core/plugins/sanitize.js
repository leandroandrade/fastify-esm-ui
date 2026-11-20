import fp from 'fastify-plugin';

// Not `\s`: that also matches U+FEFF, and a BOM has to be deleted rather than folded to a
// space. U+0085 (NEL) is named by hand because JS `\s` does not match it.
const WHITESPACE_CONTROLS = /[\t\n\v\f\r\u0085]/g;

// Zero-width characters, bidi marks and overrides, isolates, BOM, soft hyphen and lone
// surrogates: all invisible, so text carrying them can never match a term typed normally.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}]/gu;

// Past this depth the value is left as it is rather than dropped.
const MAX_DEPTH = 5;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Reduces a string to its visible content. The order below is load-bearing: anything that
 * stores text and later compares it with user input (a search index, a unique key) must
 * fold it through this same function, or the two sides never meet on identical characters.
 */
function toCleanText(value) {
  return value
    .replace(WHITESPACE_CONTROLS, ' ')
    .replace(INVISIBLE, '')
    // NFKC after the strip: a format character has combining class 0 and would block
    // canonical composition.
    .normalize('NFKC')
    // NFKC can expand a single codepoint into a whole phrase, so spaces collapse after it.
    .replace(/\s+/gu, ' ')
    .trim();
}

// Names what must NOT be walked rather than checking the prototype: `req.query` sits on a
// null-prototype object that is itself a prototype, so comparing against Object.prototype
// (or null) is too strict and would silently skip every query.
function isRecord(value) {
  const isBinary = Buffer.isBuffer(value) || ArrayBuffer.isView(value);
  const isStream = typeof value.pipe === 'function';

  return !isBinary && !isStream;
}

/**
 * Walks a request payload and cleans every string in it. Anything that is not a string, an
 * array or a plain object comes back untouched, so a raw upload stream is not mangled.
 */
function toCleanPayload(value, depth = 0) {
  if (typeof value === 'string') {
    return toCleanText(value);
  }

  const isWalkable = value !== null && typeof value === 'object' && depth < MAX_DEPTH;
  if (!isWalkable) {
    return value;
  }

  if (Array.isArray(value)) {
    function cleanEntry(entry) {
      return toCleanPayload(entry, depth + 1);
    }

    return value.map(cleanEntry);
  }

  if (!isRecord(value)) {
    return value;
  }

  const cleaned = Object.create(null);

  for (const key of Object.keys(value)) {
    if (!FORBIDDEN_KEYS.has(key)) {
      cleaned[key] = toCleanPayload(value[key], depth + 1);
    }
  }

  return cleaned;
}

async function sanitizeRequest(req) {
  req.query = toCleanPayload(req.query);
  req.params = toCleanPayload(req.params);
  req.body = toCleanPayload(req.body);
}

async function sanitizePlugin(fastify) {
  const sanitize = {
    text: toCleanText,
    payload: toCleanPayload
  };

  fastify.decorate('sanitize', sanitize);

  // preValidation, not preHandler: minLength/maxLength then apply to the cleaned value.
  fastify.addHook('preValidation', sanitizeRequest);
}

export default fp(sanitizePlugin, { name: 'sanitize' });

export {
  toCleanText,
  toCleanPayload
};
