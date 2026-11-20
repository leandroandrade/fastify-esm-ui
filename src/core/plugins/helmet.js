import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

async function helmetPlugin(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // No 'unsafe-eval': the pages run the CSP build of Alpine (@alpinejs/csp), which
        // parses expressions itself instead of calling new Function. No 'unsafe-inline' for
        // styles either — Alpine sets styles through CSSOM (el.style), which CSP allows; only a
        // `style` attribute in markup or set as a string would need it.
        scriptSrc: ["'self'"],
        scriptSrcElem: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        // Same intent as frameguard's X-Frame-Options: DENY below; helmet's default is 'self'.
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true
  });
}

export default fp(helmetPlugin, { name: 'helmet' });
