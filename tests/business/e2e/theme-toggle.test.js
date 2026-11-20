import { test } from 'node:test';

import { iniciarServidor, abrirNavegador } from '../../shared/e2e-helper.js';

async function lerTema(page) {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

async function lerCor(locator) {
  return locator.evaluate((el) => getComputedStyle(el).color);
}

// data-theme is set synchronously in <head>, but the icon x-show / @click bindings only
// activate once Alpine hydrates the button — and Alpine materializes the :aria-label then.
async function esperarHidratacao(page) {
  await page.waitForSelector('#theme-toggle[aria-label]');
}

test('[e2e] botao de tema deve aparecer no canto superior direito da navegacao', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  const toggle = page.locator('#theme-toggle');
  t.assert.ok(await toggle.isVisible(), 'o botão de tema deve estar visível');

  // Deve ser o controle mais à direita da barra: à direita do logo.
  const toggleBox = await toggle.boundingBox();
  const logoBox = await page.locator('nav a:has(svg)').first().boundingBox();
  t.assert.ok(toggleBox.x > logoBox.x, 'o botão de tema deve ficar à direita do logo');
});

test('[e2e] sem preferencia salva deve seguir o tema claro do sistema e exibir a lua', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'light' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  t.assert.strictEqual(await lerTema(page), 'light', 'deve iniciar no tema claro');

  const sol = page.locator('#theme-toggle svg').nth(0);
  const lua = page.locator('#theme-toggle svg').nth(1);
  await lua.waitFor({ state: 'visible' });
  t.assert.ok(await lua.isVisible(), 'no tema claro a lua deve estar visível');
  t.assert.ok(!(await sol.isVisible()), 'no tema claro o sol deve estar oculto');
});

test('[e2e] sem preferencia salva deve seguir o tema escuro do sistema', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'dark' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  t.assert.strictEqual(await lerTema(page), 'dark', 'deve seguir a preferência escura do sistema');

  const sol = page.locator('#theme-toggle svg').nth(0);
  await sol.waitFor({ state: 'visible' });
  t.assert.ok(await sol.isVisible(), 'no tema escuro o sol deve estar visível');

  // O sol deve ser amarelo: cor própria, distinta do cinza herdado pela lua.
  const lua = page.locator('#theme-toggle svg').nth(1);
  const corSol = await lerCor(sol);
  const corLua = await lerCor(lua);
  t.assert.ok((await sol.getAttribute('class')).includes('text-yellow-400'), 'o sol deve usar a cor amarela');
  t.assert.notStrictEqual(corSol, corLua, 'o amarelo do sol deve diferir do cinza da lua');
});

test('[e2e] clicar no botao deve alternar entre claro e escuro trocando o icone', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'light' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  const toggle = page.locator('#theme-toggle');
  const sol = toggle.locator('svg').nth(0);
  const lua = toggle.locator('svg').nth(1);

  await toggle.click();
  t.assert.strictEqual(await lerTema(page), 'dark', 'o clique deve mudar para o tema escuro');
  await sol.waitFor({ state: 'visible' });
  await lua.waitFor({ state: 'hidden' });
  t.assert.ok(await sol.isVisible(), 'após ir para o escuro o sol deve aparecer');
  t.assert.ok(!(await lua.isVisible()), 'após ir para o escuro a lua deve sumir');

  await toggle.click();
  t.assert.strictEqual(await lerTema(page), 'light', 'o segundo clique deve voltar ao tema claro');
  await lua.waitFor({ state: 'visible' });
  t.assert.ok(await lua.isVisible(), 'de volta ao claro a lua deve reaparecer');
});

test('[e2e] a escolha do tema deve persistir apos recarregar a pagina', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'light' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  await page.locator('#theme-toggle').click();
  t.assert.strictEqual(await lerTema(page), 'dark', 'deve estar escuro antes de recarregar');

  const persistido = await page.evaluate(() => localStorage.getItem('theme'));
  t.assert.strictEqual(persistido, 'dark', 'a escolha deve ser salva em localStorage');

  await page.reload();
  await esperarHidratacao(page);
  t.assert.strictEqual(await lerTema(page), 'dark', 'o tema escuro deve sobreviver ao recarregamento');
});

test('[e2e] sem escolha explicita deve acompanhar a troca de tema do sistema em tempo real', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'light' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);
  t.assert.strictEqual(await lerTema(page), 'light', 'deve iniciar no tema claro do sistema');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  t.assert.strictEqual(await lerTema(page), 'dark', 'deve seguir o sistema para escuro sem recarregar');
});

test('[e2e] apos escolha explicita deve ignorar mudancas de tema do sistema', async (t) => {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t, { colorScheme: 'light' });

  await page.goto(baseUrl);
  await esperarHidratacao(page);

  await page.locator('#theme-toggle').click();
  t.assert.strictEqual(await lerTema(page), 'dark', 'a escolha explícita deve aplicar o tema escuro');

  // O sistema muda (claro -> escuro -> claro); a escolha explícita deve prevalecer.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(150);

  t.assert.strictEqual(await lerTema(page), 'dark', 'a mudança do sistema não deve sobrepor a escolha do usuário');
});
