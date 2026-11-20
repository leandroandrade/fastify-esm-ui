import fp from 'fastify-plugin';

// Same max-age as the sitemap: both change only on deploy.
const MAX_AGE = 86400;

async function robotsPlugin(fastify) {
  // Built from PUBLIC_URL rather than kept as a static file: the Sitemap directive must be
  // absolute, and a hard-coded host would point every derived project at the wrong site.
  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${fastify.publicUrl}/sitemap.xml
`;

  fastify.get('/robots.txt', async function robots(req, reply) {
    return reply
      .type('text/plain; charset=utf-8')
      .header('Cache-Control', `public, max-age=${MAX_AGE}`)
      .send(body);
  });
}

export default fp(robotsPlugin, {
  name: 'robots',
  dependencies: ['env']
});
