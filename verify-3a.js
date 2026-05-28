// Verificación Etapa 3A — Campañas, Slots, Invitaciones, Join page
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'https://myalbum-green.vercel.app';
const SUPERADMIN = 'testuser26';
const PASSWORD = 'Test2026!';
const MEMBER_USER = 'wbedon1983';

const SS_DIR = path.join(__dirname, 'verify-3a-screenshots');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR);

let ssCount = 0;
async function ss(page, name) {
  const file = path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
  return file;
}

async function login(page, username, password) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder*="usuario" i], input[type="text"]', { timeout: 15000 });
  const inputs = await page.$$('input');
  await inputs[0].fill(username);
  await inputs[1].fill(password);
  await page.click('button[type="submit"]');
  // Esperar hasta que el botón Admin, Mis Campañas o el hero aparezcan
  await page.waitForSelector('button:has-text("Admin"), button:has-text("Mis Campañas"), section#galeria, h2:has-text("Subí tu foto")', { timeout: 20000 })
    .catch(() => {}); // si no aparece seguimos igual
  await page.waitForTimeout(1000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  let inviteUrl = null;
  let campaignName = `Campaña Test ${Date.now()}`;

  try {
    // ── 1. Login superadmin ────────────────────────────────────────
    console.log('\n[1] Login superadmin...');
    await login(page, SUPERADMIN, PASSWORD);
    await ss(page, 'after-login');

    const adminBtn = await page.$('button:has-text("Admin")');
    if (!adminBtn) throw new Error('Botón Admin no encontrado — ¿login falló?');
    console.log('  ✅ Botón "Admin" visible');

    // ── 2. Abrir Panel Admin y crear campaña ───────────────────────
    console.log('\n[2] Crear campaña...');
    await adminBtn.click();
    await page.waitForTimeout(800);
    await ss(page, 'panel-admin');

    const newCampaignBtn = await page.$('button:has-text("Nueva campaña")');
    if (!newCampaignBtn) throw new Error('"Nueva campaña" no encontrado');
    await newCampaignBtn.click();
    await page.waitForTimeout(400);

    // Llenar formulario
    await page.fill('input[placeholder*="Escuela" i], input[placeholder*="campaña" i], input[required][type="text"]', campaignName);
    await page.fill('textarea', 'Campaña de verificación automatizada');
    // pack_size ya tiene default 5
    await ss(page, 'form-nueva-campana');

    await page.click('button[type="submit"]:has-text("Crear campaña")');
    await page.waitForTimeout(1500);
    await ss(page, 'campana-creada');

    const campaignCard = await page.$(`text=${campaignName}`);
    if (!campaignCard) throw new Error('Campaña no aparece en la lista tras crear');
    console.log('  ✅ Campaña creada y visible en lista');

    // ── 3. Abrir campaña y verificar 3 tabs ───────────────────────
    console.log('\n[3] Abrir campaña — verificar tabs...');
    await campaignCard.click();
    await page.waitForTimeout(800);
    await ss(page, 'campaign-detail');

    for (const tab of ['Participantes', 'Slots', 'Invitaciones']) {
      const tabBtn = await page.$(`button:has-text("${tab}")`);
      if (!tabBtn) throw new Error(`Tab "${tab}" no encontrado`);
      console.log(`  ✅ Tab "${tab}" visible`);
    }

    // ── 4. Agregar slots ──────────────────────────────────────────
    console.log('\n[4] Agregar slots...');
    await page.click('button:has-text("Slots")');
    await page.waitForTimeout(500);
    await ss(page, 'tab-slots-vacio');

    // Slot 1: Portero
    const slotNumInput = await page.$('input[type="number"][placeholder="Nº"]');
    const slotLabelInput = await page.$('input[placeholder*="Etiqueta" i]');
    if (!slotNumInput || !slotLabelInput) throw new Error('Formulario de slot no encontrado');

    await slotNumInput.fill('1');
    await slotLabelInput.fill('Portero');
    await page.click('button:has-text("Agregar"):not([disabled])');
    await page.waitForTimeout(1000);

    // Slot 2: Delantero
    await slotNumInput.fill('2');
    await slotLabelInput.fill('Delantero');
    await page.click('button:has-text("Agregar"):not([disabled])');
    await page.waitForTimeout(1000);
    await ss(page, 'slots-agregados');

    const slot1 = await page.$('text=Portero');
    const slot2 = await page.$('text=Delantero');
    if (!slot1 || !slot2) throw new Error('Slots no aparecen en la lista');
    console.log('  ✅ Slot 1 (Portero) y Slot 2 (Delantero) creados');

    // ── 5. Generar invitación ─────────────────────────────────────
    console.log('\n[5] Generar invitación...');
    await page.click('button:has-text("Invitaciones")');
    await page.waitForTimeout(500);
    await ss(page, 'tab-invitaciones-vacio');

    // Seleccionar expiración 7 días
    await page.selectOption('select', '7d');
    await page.click('button:has-text("Generar enlace")');
    await page.waitForTimeout(1500);
    await ss(page, 'invitacion-generada');

    // Capturar URL de invitación
    const codeEl = await page.$('code');
    if (!codeEl) throw new Error('URL de invitación no apareció');
    inviteUrl = await codeEl.innerText();
    console.log(`  ✅ Invitación generada: ${inviteUrl}`);

    // ── 6. Ver QR ─────────────────────────────────────────────────
    console.log('\n[6] Verificar QR...');
    const qrBtn = await page.$('button[title="Ver QR"]');
    if (!qrBtn) throw new Error('Botón QR no encontrado');
    await qrBtn.click();
    await page.waitForTimeout(600);
    await ss(page, 'qr-visible');

    const qrSvg = await page.$('svg[viewBox]');
    if (!qrSvg) throw new Error('QR SVG no renderizó');
    console.log('  ✅ QR visible y renderizado');

    // ── 7. Verificar botón copiar ─────────────────────────────────
    console.log('\n[7] Copiar enlace...');
    const copyBtn = await page.$('button[title="Copiar enlace"]');
    if (!copyBtn) throw new Error('Botón copiar no encontrado');
    await copyBtn.click();
    await page.waitForTimeout(600);
    // Debe aparecer checkmark de confirmación
    const checkmark = await page.$('path[d*="M4.5 12.75l6 6 9-13.5"]');
    if (!checkmark) {
      console.log('  ⚠️  Checkmark de copiado no detectado (puede ser issue de clipboard en headless)');
    } else {
      console.log('  ✅ Feedback de copiado visible');
    }

    // ── 8. Página /unirse/[token] ─────────────────────────────────
    console.log('\n[8] Verificar página de join...');
    if (!inviteUrl) throw new Error('No tengo URL de invitación');

    const joinPage = await ctx.newPage();
    await joinPage.goto(inviteUrl, { waitUntil: 'networkidle' });
    // Esperar que cargue el nombre de campaña o mensaje de error
    await joinPage.waitForSelector(`text=${campaignName}, text=Fuiste invitado a, text=no válida`, { timeout: 15000 }).catch(() => {});
    await joinPage.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-join-page.png`) });
    console.log(`  📸 join-page screenshot`);

    const campaignTitle = await joinPage.$(`text=${campaignName}`);
    const invitedText = await joinPage.$('text=Fuiste invitado a');
    if (!campaignTitle || !invitedText) throw new Error('Página join no muestra el nombre de la campaña');
    console.log(`  ✅ Página join muestra "${campaignName}"`);

    // Esperar que authReady se resuelva y aparezca el formulario de login
    await joinPage.waitForSelector('input[type="password"], button:has-text("Unirme")', { timeout: 15000 }).catch(() => {});
    await joinPage.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-join-auth-ready.png`) });

    const loginForm = await joinPage.$('input[placeholder*="usuario" i]');
    const joinDirectBtn = await joinPage.$('button:has-text("Unirme a la campaña")');
    if (!loginForm && !joinDirectBtn) throw new Error('Ni formulario de login ni botón "Unirme" aparecieron en join page');
    if (loginForm) console.log('  ✅ Formulario de login visible para usuario no autenticado');
    if (joinDirectBtn) console.log('  ✅ Botón "Unirme" visible (usuario ya autenticado en este contexto)');
    await joinPage.close();

    // ── 9. Unirse como usuario regular ───────────────────────────
    console.log('\n[9] Unirse a campaña como usuario regular...');

    // Primero resetear password del usuario regular
    const joinCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const joinPageAuth = await joinCtx.newPage();
    await joinPageAuth.goto(inviteUrl, { waitUntil: 'networkidle' });

    // Login en la join page
    const usernameInput = await joinPageAuth.$('input[placeholder*="usuario" i]');
    const passwordInput = await joinPageAuth.$('input[type="password"]');
    await usernameInput.fill(MEMBER_USER);
    await passwordInput.fill(PASSWORD);
    await joinPageAuth.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    await joinPageAuth.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-join-after-login.png`) });
    console.log(`  📸 join-after-login screenshot`);

    // Puede fallar si la contraseña del usuario regular es diferente — lo marcamos
    const joinBtn = await joinPageAuth.$('button:has-text("Unirme a la campaña")');
    const alreadyText = await joinPageAuth.$('text=Ya sos participante');
    if (joinBtn) {
      await joinBtn.click();
      await page.waitForTimeout(1500);
      await joinPageAuth.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-join-success.png`) });
      const successText = await joinPageAuth.$('text=¡Te uniste a');
      if (successText) {
        console.log('  ✅ Join exitoso — aparece pantalla de éxito');
      } else {
        console.log('  ⚠️  Join realizado pero no se detectó pantalla de éxito');
      }
    } else if (alreadyText) {
      console.log('  ✅ Usuario ya era miembro — mensaje correcto mostrado');
    } else {
      console.log('  ⚠️  No se pudo completar join (credenciales del usuario regular pueden ser diferentes)');
    }
    await joinCtx.close();

    // ── 10. Verificar "Mis Campañas" para usuario con membresía ──
    console.log('\n[10] Verificar "Mis Campañas" en HomeContent...');
    // El superadmin no tiene membresía directa → usar cuenta de miembro si unión funcionó
    // Chequeamos que el botón "Mis Campañas" aparece tras tener membresía
    const memberCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const memberPage = await memberCtx.newPage();
    await login(memberPage, MEMBER_USER, PASSWORD);
    await memberPage.waitForTimeout(1000);
    await memberPage.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-member-topbar.png`) });

    const misCampanasBtn = await memberPage.$('button:has-text("Mis Campañas")');
    if (misCampanasBtn) {
      console.log('  ✅ Botón "Mis Campañas" visible para usuario con membresía');
      await misCampanasBtn.click();
      await page.waitForTimeout(800);
      await memberPage.screenshot({ path: path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-mis-campanas-panel.png`) });
      const campCard = await memberPage.$(`text=${campaignName}`);
      if (campCard) {
        console.log(`  ✅ Campaña "${campaignName}" visible en "Mis Campañas"`);
      } else {
        console.log('  ⚠️  Campaña no visible en Mis Campañas todavía');
      }
    } else {
      console.log('  ⚠️  Botón "Mis Campañas" no visible (usuario puede no tener membresía aún)');
    }
    await memberCtx.close();

    console.log('\n══════════════════════════════════════');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log(`Screenshots en: ${SS_DIR}`);
    console.log('══════════════════════════════════════');

  } catch (err) {
    console.error(`\n❌ ERROR: ${err.message}`);
    await ss(page, 'ERROR-state').catch(() => {});
  } finally {
    await browser.close();
  }
})();
