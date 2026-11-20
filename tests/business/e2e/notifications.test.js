import { test } from 'node:test';

import { buildRawApp } from '../../shared/helper.js';
import { iniciarServidor, abrirNavegador } from '../../shared/e2e-helper.js';

async function abrirHome(t) {
  const { baseUrl } = await iniciarServidor(t);
  const { page } = await abrirNavegador(t);

  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  return { page };
}

const CASOS = [
  { botao: 'Success', trecho: 'sucesso', icone: 'svg.text-green-600' },
  { botao: 'Error', trecho: 'erro', icone: 'svg.text-red-600' },
  { botao: 'Warning', trecho: 'Atenção', icone: 'svg.text-amber-600' },
  { botao: 'Info', trecho: 'Informação', icone: 'svg.text-blue-600' }
];

test('[e2e] sistema de notificacoes Alpine.js deve estar configurado', async (t) => {
  const { page } = await abrirHome(t);

  const notificationElement = page.locator('#notification-alert');
  t.assert.strictEqual(await notificationElement.count(), 1, 'Elemento de notificação deve existir');
  t.assert.ok(!(await notificationElement.isVisible()), 'Notificação deve estar oculta inicialmente');
});

for (const { botao, trecho, icone } of CASOS) {
  test(`[e2e] notificacao ${botao} deve aparecer ao clicar no botao`, async (t) => {
    const { page } = await abrirHome(t);

    await page.locator(`button:text-is("${botao}")`).click();

    const notificationElement = page.locator('#notification-alert');
    await notificationElement.waitFor({ state: 'visible', timeout: 3000 });

    const texto = await notificationElement.textContent();
    t.assert.ok(texto.includes(trecho), `Notificação deve conter "${trecho}"`);

    const iconeVisivel = notificationElement.locator(icone).first();
    await iconeVisivel.waitFor({ state: 'visible', timeout: 3000 });
    t.assert.ok(await iconeVisivel.isVisible(), `Notificação ${botao} deve ter o ícone da sua cor`);
  });
}

test('[e2e] notificacao deve desaparecer automaticamente apos timeout', async (t) => {
  const { page } = await abrirHome(t);

  await page.locator('button:text-is("Success")').click();

  const notificationElement = page.locator('#notification-alert');
  await notificationElement.waitFor({ state: 'visible', timeout: 3000 });
  await notificationElement.waitFor({ state: 'hidden', timeout: 7000 });

  t.assert.ok(!(await notificationElement.isVisible()), 'Notificação deve desaparecer após timeout');
});

test('[e2e] notificacao deve fechar pelo botao de fechar', async (t) => {
  const { page } = await abrirHome(t);

  await page.locator('button:text-is("Info")').click();

  const notificationElement = page.locator('#notification-alert');
  await notificationElement.waitFor({ state: 'visible', timeout: 3000 });

  await notificationElement.locator('button:has-text("Close notification")').click();
  await notificationElement.waitFor({ state: 'hidden', timeout: 3000 });

  t.assert.ok(!(await notificationElement.isVisible()), 'Notificação deve fechar pelo botão');
});

test('[e2e] factory Alpine.notificadores deve estar disponivel e disparar notificacao', async (t) => {
  const { page } = await abrirHome(t);

  const metodos = await page.evaluate(() => {
    const helpers = window.Alpine.notificadores();
    return Object.keys(helpers).sort();
  });
  t.assert.deepStrictEqual(metodos, ['notificarAviso', 'notificarErro', 'notificarInfo', 'notificarSucesso']);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: { message: 'Teste programático', type: 'success', duration: 5000 }
    }));
  });

  const notificationElement = page.locator('#notification-alert');
  await notificationElement.waitFor({ state: 'visible', timeout: 3000 });

  t.assert.ok((await notificationElement.textContent()).includes('Teste programático'), 'Notificação deve exibir mensagem customizada');
});

// `errorMsg` passed to a view is shown through the same toast stack, as text.
test('[e2e] mensagem de erro renderizada pelo servidor deve virar notificacao', async (t) => {
  const fastify = await buildRawApp();
  t.after(() => fastify.close());

  fastify.get('/flash-probe', function flashProbe(req, reply) {
    return reply.view('home', { errorMsg: 'Falha <b>ao salvar</b>', scripts: ['api-demo.js'] }, { layout: 'layout' });
  });

  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = fastify.server.address();

  const { page } = await abrirNavegador(t);
  await page.goto(`http://localhost:${port}/flash-probe`);

  const notificationElement = page.locator('#notification-alert');
  await notificationElement.waitFor({ state: 'visible', timeout: 3000 });

  t.assert.ok((await notificationElement.textContent()).includes('Falha <b>ao salvar</b>'), 'a mensagem deve aparecer como texto, sem virar HTML');
  t.assert.strictEqual(await notificationElement.locator('b').count(), 0);
});
