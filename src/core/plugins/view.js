import fp from 'fastify-plugin';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import { resolve } from 'node:path';

const SITE_NAME = 'Fastify ESM';

const DESCRIPTION = 'Template para aplicações REST com interface web usando Fastify, EJS, TailwindCSS e Alpine.js.';

async function viewPlugin(fastify) {
  const commitSha = fastify.config.GIT_COMMIT_HASH.slice(0, 7);

  // Serialized here, not in the template: EJS escaping would corrupt the JSON rather than
  // protect it. The trailing replace guards the block itself — the HTML tokenizer ends a
  // script element at the literal `</script` and JSON.stringify does not escape `<`.
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${fastify.publicUrl}/`,
    description: DESCRIPTION,
    inLanguage: 'pt-BR'
  }).replaceAll('<', '\\u003c');

  // Every view gets these; a route overrides any of them by passing the same key. A page
  // other than the home must pass its own `canonicalPath`, or it canonicalizes to `/`.
  const defaultContext = {
    siteName: SITE_NAME,
    commitSha,
    publicUrl: fastify.publicUrl,
    title: SITE_NAME,
    description: DESCRIPTION,
    canonicalPath: '/',
    // Path under publicUrl; social networks fetch it out of band, so the layout makes it
    // absolute. 1200x630 is the size every network crops cleanly.
    ogImage: '/public/assets/og-image.png',
    currentPage: '',
    scripts: [],
    // Links to /docs are only rendered when the route exists.
    docsEnabled: fastify.config.DOCS_ENABLED,
    structuredData
  };

  await fastify.register(fastifyView, {
    engine: {
      ejs
    },
    templates: 'templates',
    options: {
      filename: resolve('templates')
    },
    charset: 'utf-8',
    defaultContext
  });
}

export default fp(viewPlugin, {
  name: 'view',
  dependencies: ['env']
});
