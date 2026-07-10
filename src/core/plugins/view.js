import fp from 'fastify-plugin';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import { resolve } from 'node:path';

async function viewPlugin(fastify, opts) {
  fastify.register(fastifyView, {
    engine: {
      ejs
    },
    templates: 'templates',
    options: {
      filename: resolve('templates')
    },
    charset: 'utf-8'
  });
}

export default fp(viewPlugin, {
  name: 'view'
});
