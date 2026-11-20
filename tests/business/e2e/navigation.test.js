import { test } from 'node:test';

import { iniciarServidor, abrirNavegador } from '../../shared/e2e-helper.js';

const MOBILE = { viewport: { width: 375, height: 667 } };

async function abrirHome(t, options) {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, options);

  await page.goto(baseUrl);
  await page.waitForSelector('nav');

  return { page, baseUrl };
}

test('[e2e] estrutura completa da navegacao deve estar presente', async (t) => {
  const { page } = await abrirHome(t);

  t.assert.ok(await page.locator('nav a:has-text("Home")').first().isVisible(), 'Menu Home deve estar visível');
  t.assert.ok(await page.locator('nav a:has-text("API Docs")').first().isVisible(), 'Menu API Docs deve estar visível');
  t.assert.ok(await page.locator('nav a:has-text("GitHub")').first().isVisible(), 'Menu GitHub deve estar visível');
  t.assert.ok(await page.locator('nav svg').first().isVisible(), 'Logo deve estar visível');
  t.assert.ok(await page.locator('nav strong:has-text("Fastify ESM")').isVisible(), 'Texto Fastify ESM deve estar visível');
});

test('[e2e] link da pagina atual deve ser marcado com aria-current', async (t) => {
  const { page } = await abrirHome(t);

  const home = page.locator('nav a:has-text("Home")').first();
  t.assert.strictEqual(await home.getAttribute('aria-current'), 'page');

  const docs = page.locator('nav a:has-text("API Docs")').first();
  t.assert.strictEqual(await docs.getAttribute('aria-current'), null);
});

test('[e2e] navegacao para Home deve funcionar', async (t) => {
  const { page, baseUrl } = await abrirHome(t);

  await page.locator('nav a:has-text("Home")').first().click();
  await page.waitForURL(`${baseUrl}/`);

  t.assert.strictEqual(page.url(), `${baseUrl}/`, 'Deve estar na página home');
});

test('[e2e] logo deve navegar para pagina inicial', async (t) => {
  const { page, baseUrl } = await abrirHome(t);

  await page.locator('nav a:has(svg)').first().click();
  await page.waitForURL(`${baseUrl}/`);

  t.assert.strictEqual(page.url(), `${baseUrl}/`, 'Logo deve navegar para página inicial');
});

test('[e2e] link do GitHub deve ter target blank', async (t) => {
  const { page } = await abrirHome(t);

  const githubLink = page.locator('nav a:has-text("GitHub")').first();

  t.assert.strictEqual(await githubLink.getAttribute('target'), '_blank', 'Link do GitHub deve ter target="_blank"');
  t.assert.strictEqual(await githubLink.getAttribute('rel'), 'noopener noreferrer', 'Link do GitHub deve ter rel="noopener noreferrer"');
  t.assert.ok((await githubLink.getAttribute('href')).includes('github.com'), 'Link do GitHub deve apontar para github.com');
});

test('[e2e] menu mobile deve estar presente e funcionar', async (t) => {
  const { page } = await abrirHome(t, MOBILE);

  const botao = page.locator('button[aria-controls="mobile-menu"]');
  t.assert.ok(await botao.isVisible(), 'Botão de menu mobile deve estar visível em telas pequenas');
  t.assert.strictEqual(await botao.getAttribute('aria-expanded'), 'false');

  const menu = page.locator('#mobile-menu');
  t.assert.ok(!(await menu.isVisible()), 'Menu mobile deve estar oculto inicialmente');

  await botao.click();
  await menu.waitFor({ state: 'visible' });
  t.assert.strictEqual(await botao.getAttribute('aria-expanded'), 'true', 'aria-expanded deve acompanhar o menu');

  t.assert.ok(await menu.locator('a:has-text("Home")').isVisible(), 'Item Home deve estar visível no menu mobile');
  t.assert.ok(await menu.locator('a:has-text("API Docs")').isVisible(), 'Item API Docs deve estar visível no menu mobile');
  t.assert.ok(await menu.locator('a:has-text("GitHub")').isVisible(), 'Item GitHub deve estar visível no menu mobile');
});

test('[e2e] menu mobile deve fechar ao clicar em um item', async (t) => {
  const { page } = await abrirHome(t, MOBILE);

  await page.locator('button[aria-controls="mobile-menu"]').click();

  const menu = page.locator('#mobile-menu');
  await menu.waitFor({ state: 'visible' });

  await menu.locator('a:has-text("Home")').click();
  await menu.waitFor({ state: 'hidden' });

  t.assert.ok(!(await menu.isVisible()), 'Menu mobile deve fechar após clique em item');
});

test('[e2e] skip link deve levar ao conteudo pelo teclado', async (t) => {
  const { page } = await abrirHome(t);

  await page.keyboard.press('Tab');

  const skipLink = page.locator('a.skip-link');
  t.assert.ok(await skipLink.isVisible(), 'O skip link deve aparecer ao receber foco');

  await page.keyboard.press('Enter');
  t.assert.ok(page.url().endsWith('#conteudo'), 'Deve saltar para o conteúdo');
});

test('[e2e] footer deve estar presente em todas as paginas', async (t) => {
  const { page } = await abrirHome(t);

  const footer = page.locator('footer');
  t.assert.ok(await footer.isVisible(), 'Footer deve estar visível');

  const footerText = await footer.textContent();
  t.assert.ok(footerText.includes('Fastify ESM UI'), 'Footer deve conter "Fastify ESM UI"');
  t.assert.ok(footerText.includes('UI Template'), 'Footer deve conter "UI Template"');
  t.assert.ok(footerText.includes(new Date().getFullYear().toString()), 'Footer deve exibir o ano atual');
  t.assert.ok(footerText.includes('build'), 'Footer deve exibir o commit do build');
});
