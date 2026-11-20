import fp from 'fastify-plugin';

// Same max-age as robots.txt: both change only on deploy.
const MAX_AGE = 86400;

// Every public, indexable page. A new page in src/business/views/ goes here too —
// tests/core/plugins/sitemap.test.js asserts that each listed path answers 200.
const PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' }
];

const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

function escapeXml(value) {
  function toEntity(char) {
    return XML_ESCAPES[char];
  }

  return value.replace(/[&<>"']/g, toEntity);
}

async function sitemapPlugin(fastify) {
  function toUrlEntry(page) {
    return `  <url>
    <loc>${escapeXml(fastify.publicUrl + page.path)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  const entries = PAGES.map(toUrlEntry).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  fastify.get('/sitemap.xml', async function sitemap(req, reply) {
    return reply
      .type('application/xml; charset=utf-8')
      .header('Cache-Control', `public, max-age=${MAX_AGE}`)
      .send(body);
  });
}

export default fp(sitemapPlugin, {
  name: 'sitemap',
  dependencies: ['env']
});
