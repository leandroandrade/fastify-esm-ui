import { chromium, firefox } from 'playwright';
import { buildRawApp } from './helper.js';

const NAVEGADORES = { chromium, firefox };

function resolverNome(nome) {
  return nome || process.env.E2E_BROWSER || 'chromium';
}

function selecionarNavegador(nome) {
  const navegador = NAVEGADORES[nome];
  if (!navegador) {
    throw new Error(`e2e-helper: navegador "${nome}" não suportado. Use: ${Object.keys(NAVEGADORES).join(', ')}`);
  }

  return navegador;
}

// buildRawApp, not buildApp: it sets `forceCloseConnections: true`. Fastify's default only
// closes *idle* connections, and Chromium leaves a speculative socket behind that has sent
// part of a request and never finishes it. That socket is not idle, so `fastify.close()`
// waited for it until `connectionTimeout` (120s) destroyed it — two minutes of dead
// wall-clock time landing on whichever test happened to lose the race.
async function iniciarServidor(t, customConfigs) {
  const fastify = await buildRawApp(customConfigs);
  await fastify.listen({ port: 0, host: '127.0.0.1' });

  t.after(async () => {
    await fastify.close();
  });

  const { port } = fastify.server.address();
  const baseUrl = `http://localhost:${port}`;

  return {
    fastify,
    baseUrl
  };
}

async function abrirNavegador(t, options = {}) {
  const { navegador, ...contextOptions } = options;

  const nome = resolverNome(navegador);
  const engine = selecionarNavegador(nome);
  const launchOptions = { headless: true };

  // Firefox drops Playwright's per-context colorScheme override once the document sends
  // Cross-Origin-Opener-Policy (helmet does): COOP isolates the browsing-context group and the
  // emulation does not follow the document into it, so matchMedia('(prefers-color-scheme: dark)')
  // reads light on load. Setting the OS-level preference at launch survives COOP and reaches the
  // synchronous theme-init.js in <head>.
  const emulaTemaFirefox = nome === 'firefox' && contextOptions.colorScheme;
  if (emulaTemaFirefox) {
    launchOptions.firefoxUserPrefs = {
      'ui.systemUsesDarkTheme': contextOptions.colorScheme === 'dark' ? 1 : 0
    };
  }

  const browser = await engine.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  t.after(async () => {
    await browser.close();
  });

  return { browser, context, page };
}

export {
  iniciarServidor,
  abrirNavegador
};
