import { test } from 'node:test';

import { iniciarServidor, abrirNavegador } from '../../shared/e2e-helper.js';

async function abrirHome(t, options) {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, options);

  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  return { page, baseUrl };
}

test('[e2e] home page deve carregar corretamente com todos os elementos', async (t) => {
  const { page } = await abrirHome(t);

  await page.waitForSelector('h1:has-text("Fastify ESM")');

  t.assert.ok(await page.locator('h1:has-text("Fastify ESM")').isVisible(), 'Título principal deve estar visível');
  t.assert.ok(await page.locator('p:has-text("Template pronto para construção de APIs REST")').isVisible(), 'Descrição deve estar visível');
  t.assert.ok(await page.locator('a:has-text("Ver Documentação da API")').isVisible(), 'Botão de documentação da API deve estar visível');
  t.assert.ok(await page.locator('a:has-text("Ver no GitHub")').isVisible(), 'Botão do GitHub deve estar visível');
});

test('[e2e] home page deve exibir os 6 cards de features', async (t) => {
  const { page } = await abrirHome(t);

  const cardCount = await page.locator('.grid > div.card').count();
  t.assert.strictEqual(cardCount, 6, 'Deve haver 6 cards de features');

  const titulos = ['Fastify Framework', 'Templates EJS', 'TailwindCSS v4', 'Alpine.js', 'API Documentation', 'Error Handling'];
  for (const titulo of titulos) {
    const card = page.locator(`h3:has-text("${titulo}")`).first();
    t.assert.ok(await card.isVisible(), `Card ${titulo} deve estar visível`);
  }
});

test('[e2e] navegacao para API documentation deve funcionar', async (t) => {
  const { page } = await abrirHome(t);

  await page.locator('a:has-text("Ver Documentação da API")').first().click();
  await page.waitForSelector('.swagger-ui .info');

  t.assert.ok(page.url().includes('/docs'), 'Deve navegar para /docs');
});

test('[e2e] secao de getting started deve estar presente', async (t) => {
  const { page } = await abrirHome(t);

  t.assert.ok(await page.locator('h2:has-text("Começando")').isVisible(), 'Seção "Começando" deve estar visível');

  const comandos = ['npm install', 'npm run build', 'cp .env.example .env', 'npm run dev'];
  for (const comando of comandos) {
    t.assert.ok(await page.locator(`pre:has-text("${comando}")`).isVisible(), `Comando ${comando} deve estar visível`);
  }
});

test('[e2e] demo de integracao deve chamar a API e exibir a resposta', async (t) => {
  const { page } = await abrirHome(t);

  await page.fill('input[aria-label="Seu nome"]', 'Ana');
  await page.click('button:has-text("Enviar Requisição")');

  const resposta = page.locator('pre:has-text("Hello Ana!")');
  await resposta.waitFor({ state: 'visible' });

  const json = JSON.parse(await resposta.textContent());
  t.assert.strictEqual(json.message, 'Hello Ana!');
  t.assert.strictEqual(json.success, true);

  const notificacao = page.locator('#notification-alert');
  await notificacao.waitFor({ state: 'visible' });
  t.assert.ok((await notificacao.textContent()).includes('Hello Ana!'), 'A resposta também deve virar uma notificação');
});

test('[e2e] demo de notificacoes deve estar presente', async (t) => {
  const { page } = await abrirHome(t);

  t.assert.ok(await page.locator('h2:has-text("Teste o Sistema de Notificações")').isVisible(), 'Título da demo de notificações deve estar visível');

  for (const rotulo of ['Success', 'Error', 'Warning', 'Info']) {
    t.assert.ok(await page.locator(`button:text-is("${rotulo}")`).isVisible(), `Botão ${rotulo} deve estar visível`);
  }
});

// The CSP build of Alpine rejects unsupported expressions (arrow functions, globals such as
// JSON or Date, template literals) with only a console warning, and a CSP violation is only a
// console error. Without this test either one leaves a page silently half-working.
test('[e2e] navegar pela home nao deve gerar erro no console nem violacao de CSP', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  const problemas = [];
  function registrar(mensagem) {
    const ehErro = mensagem.type() === 'error';
    const ehAvisoDoAlpine = mensagem.type() === 'warning' && mensagem.text().includes('Alpine');
    if (ehErro || ehAvisoDoAlpine) {
      problemas.push(`${mensagem.type()}: ${mensagem.text()}`);
    }
  }
  function registrarExcecao(erro) {
    problemas.push(`pageerror: ${erro.message}`);
  }
  page.on('console', registrar);
  page.on('pageerror', registrarExcecao);

  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  await page.fill('input[aria-label="Seu nome"]', 'Ana');
  await page.click('button:has-text("Enviar Requisição")');
  await page.waitForSelector('pre:has-text("Hello Ana!")');

  await page.click('button:text-is("Warning")');
  await page.click('#theme-toggle');

  await page.goto(`${baseUrl}/docs`);
  await page.waitForSelector('.swagger-ui .info');

  t.assert.deepStrictEqual(problemas, []);
});
