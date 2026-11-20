import { test } from 'node:test';

import { iniciarServidor, abrirNavegador } from '../../shared/e2e-helper.js';

async function abrir404(t, rota = '/rota-inexistente', options) {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, options);

  const response = await page.goto(`${baseUrl}${rota}`);
  await page.waitForSelector('h1:has-text("404")');

  return { page, response, baseUrl };
}

test('[e2e] pagina 404 deve carregar corretamente para rotas nao encontradas', async (t) => {
  const { page, response } = await abrir404(t);

  t.assert.strictEqual(response.status(), 404, 'Deve retornar status 404');
  t.assert.ok(await page.locator('h1:has-text("404")').isVisible(), 'Título 404 deve estar visível');
  t.assert.ok(await page.locator('h2:has-text("Página não encontrada")').isVisible(), 'Subtítulo deve estar visível');
  t.assert.ok(await page.locator('p:has-text("A página que você está procurando não existe ou foi movida")').isVisible(), 'Mensagem explicativa deve estar visível');
  t.assert.ok(await page.locator('a:has-text("Ir para a página inicial")').isVisible(), 'Botão de voltar para home deve estar visível');
});

test('[e2e] pagina 404 deve ter logo clicavel', async (t) => {
  const { page } = await abrir404(t);

  const logo = page.locator('a:has(svg)').first();
  t.assert.ok(await logo.isVisible(), 'Logo deve estar visível na página 404');
  t.assert.strictEqual(await logo.getAttribute('href'), '/', 'Logo deve ter link para página inicial');
});

test('[e2e] botao de voltar da pagina 404 deve navegar para home', async (t) => {
  const { page, baseUrl } = await abrir404(t);

  await page.locator('a:has-text("Ir para a página inicial")').click();
  await page.waitForURL(`${baseUrl}/`);

  t.assert.ok(await page.locator('h1:has-text("Fastify ESM")').isVisible(), 'Deve estar na página home');
});

test('[e2e] pagina 404 deve ter footer com ano atual', async (t) => {
  const { page } = await abrir404(t);

  const footer = page.locator('footer');
  t.assert.ok(await footer.isVisible(), 'Footer deve estar visível na página 404');
  t.assert.ok((await footer.textContent()).includes(new Date().getFullYear().toString()), 'Footer deve conter o ano atual');
});

test('[e2e] rotas de API devem retornar JSON 404, nao HTML', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  const response = await page.goto(`${baseUrl}/api/rota-inexistente`);
  t.assert.strictEqual(response.status(), 404, 'Deve retornar status 404');
  t.assert.ok(response.headers()['content-type'].includes('application/json'), 'Deve retornar JSON para rotas /api');

  const body = await response.json();
  t.assert.strictEqual(body.statusCode, 404);
  t.assert.strictEqual(body.error, 'Not Found');
  t.assert.ok(body.message, 'Body deve ter mensagem de erro');
});

// The error pages are standalone documents (no layout), so they load theme-init.js
// themselves — otherwise a visitor in dark mode would be flashed a light page.
test('[e2e] pagina 404 deve respeitar o tema escuro escolhido', async (t) => {
  const { page } = await abrir404(t, '/rota-inexistente', { colorScheme: 'dark' });

  t.assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
});

test('[e2e] pagina 500 deve ser exibida para erro interno', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  const response = await page.goto(`${baseUrl}/error/500`);
  t.assert.strictEqual(response.status(), 500);

  await page.waitForSelector('h1:has-text("500")');
  t.assert.ok(await page.locator('h2:has-text("Erro interno do servidor")').isVisible());
});

test('[e2e] multiplas requisicoes 404 devem sempre retornar a pagina de erro', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  for (const rota of ['/nao-existe', '/outra-rota', '/mais-uma-rota']) {
    const response = await page.goto(`${baseUrl}${rota}`);
    t.assert.strictEqual(response.status(), 404, `${rota} deve retornar 404`);

    await page.waitForSelector('h1:has-text("404")');
    t.assert.ok(await page.locator('h1:has-text("404")').isVisible(), `${rota} deve mostrar página 404`);
  }
});
