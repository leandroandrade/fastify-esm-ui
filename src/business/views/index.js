import fp from 'fastify-plugin';

// Every view also receives the defaults set in src/core/plugins/view.js (siteName,
// description, canonicalPath, publicUrl, commitSha, scripts...). A new public page passes its
// own `title`, `description` and `canonicalPath`, and is listed in
// src/core/plugins/sitemap.js.
async function viewsPlugin(app) {
  app.get('/', function homePage(req, reply) {
    return reply.view('home', {
      title: 'Fastify ESM | REST API Template',
      scripts: ['api-demo.js'],
      currentPage: 'home'
    }, { layout: 'layout' });
  });

  app.get('/error/404', function notFoundPage(req, reply) {
    return reply.code(404).view('404.ejs');
  });

  app.get('/error/500', function serverErrorPage(req, reply) {
    return reply.code(500).view('500.ejs');
  });

  return app;
}

export default fp(viewsPlugin);
