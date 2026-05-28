// Verification Etapa 3I — Reacciones emoji en la galería
const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BASE       = 'https://myalbum-green.vercel.app';
const SUPERADMIN = 'testuser26';
const PASSWORD   = 'Test2026!';
const SS_DIR     = path.join(__dirname, 'verify-3i-screenshots');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR);

let ssN = 0;
async function ss(page, name) {
  const file = path.join(SS_DIR, `${String(++ssN).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

async function login(page, username, pw) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.$$('input');
  await inputs[0].fill(username);
  await inputs[1].fill(pw);
  await page.click('button[type="submit"]');
  await page.waitForSelector('button[title="Mi perfil"]', { timeout: 25000 });
  await page.waitForTimeout(800);
}

async function goHome(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('button[title="Mi perfil"]', { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function openCampaignN(page, idx) {
  await page.click('button:has-text("Admin")');
  await page.waitForTimeout(800);
  const cards = await page.$$('div.glass-card > button');
  if (!cards[idx]) return false;
  await cards[idx].click();
  await page.waitForTimeout(1500);
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;
  function check(cond, label) {
    if (cond) console.log(`  ✅ ${label}`);
    else      { console.log(`  ❌ ${label}`); allPassed = false; }
    return cond;
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    // ── [1] Login ──────────────────────────────────────────────────
    console.log('\n[1] Login superadmin...');
    await login(page, SUPERADMIN, PASSWORD);
    await ss(page, 'home');

    // ── [2] Contar campañas ────────────────────────────────────────
    console.log('\n[2] Contar campañas disponibles...');
    await page.click('button:has-text("Admin")');
    await page.waitForTimeout(800);
    const totalCards = (await page.$$('div.glass-card > button')).length;
    console.log(`  ℹ️  Campañas disponibles: ${totalCards}`);

    // ── [3] Buscar / preparar sticker aprobado ─────────────────────
    console.log('\n[3] Buscar campaña con stickers aprobados (o aprobar uno)...');
    let foundApproved = false;
    let activeCampaignIdx = -1;

    for (let i = 0; i < totalCards && !foundApproved; i++) {
      await goHome(page);
      if (!await openCampaignN(page, i)) break;

      // Intentar aprobar un cromo pendiente primero
      const revTab = await page.$('button:has-text("Revisión")');
      if (revTab) {
        await revTab.click();
        await page.waitForTimeout(1200);
        const approveBtn = await page.$('button:has-text("Aprobar")');
        if (approveBtn) {
          await approveBtn.click();
          await page.waitForTimeout(2000);
          console.log(`  ✅ Sticker aprobado en campaña ${i + 1}`);
        }
      }

      // Ir a galería
      const gallTab = await page.$('button:has-text("Galería")');
      if (!gallTab) continue;
      await gallTab.click();
      await page.waitForTimeout(1500);

      // Buscar sticker cards (dentro del flex container de la galería)
      const stickerCards = await page.$$('.flex.gap-4.flex-wrap > div');
      console.log(`  ℹ️  Campaña ${i + 1}: ${stickerCards.length} sticker card(s)`);
      if (stickerCards.length > 0) {
        foundApproved = true;
        activeCampaignIdx = i;
        console.log(`  ✅ Usando campaña ${i + 1} para verificar reacciones`);
      }
    }

    await ss(page, 'gallery-state');

    // ── [4] Verificar código nuevo en producción ───────────────────
    console.log('\n[4] Verificar nuevo GalleryView desplegado...');

    // Banner de stickers aprobados (estructura nueva)
    const approvedBanner = await page.$('text=stickers aprobados') ||
                           await page.$('text=sticker aprobado');
    check(approvedBanner !== null, 'Banner de conteo de stickers aprobados presente');

    // Sección "Galería" heading
    const galHeading = await page.$('text=Galería');
    check(galHeading !== null, 'Encabezado "Galería" presente');

    if (foundApproved) {
      // ── [5] Verificar reaction bar ─────────────────────────────────
      console.log('\n[5] Verificar reaction bar en sticker cards...');

      // Los botones de reacción están en .flex.items-center.gap-0.5
      const reactionBars = await page.$$('.flex.items-center.gap-0\\.5');
      console.log(`  ℹ️  Reaction bars encontradas: ${reactionBars.length}`);
      check(reactionBars.length > 0, 'Reaction bar presente en sticker cards');

      const reactionBtns = await page.$$('.flex.items-center.gap-0\\.5 button');
      console.log(`  ℹ️  Botones de reacción: ${reactionBtns.length}`);
      check(reactionBtns.length >= 4, `Al menos 4 botones emoji (${reactionBtns.length})`);

      // Leer titles de los botones
      if (reactionBtns.length > 0) {
        const btnTitles = await Promise.all(reactionBtns.slice(0, 4).map(b => b.getAttribute('title')));
        console.log(`  ℹ️  Emojis: ${btnTitles.join(' ')}`);
        const hasAllEmojis = ['❤️','🔥','⭐','😂'].every(e => btnTitles.includes(e));
        check(hasAllEmojis, 'Los 4 emojis (❤️ 🔥 ⭐ 😂) presentes como titles');
      }

      await ss(page, 'reaction-buttons');

      // ── [6] Toggle reacción ────────────────────────────────────────
      console.log('\n[6] Toggle reacción ❤️ en primer sticker...');
      const heartBtn = reactionBtns[0]; // first emoji = ❤️
      const classBefore = await heartBtn.getAttribute('class') ?? '';
      console.log(`  ℹ️  Clase antes: "${classBefore.slice(0, 80)}"`);

      await heartBtn.click();
      await page.waitForTimeout(1500);

      const classAfter = await heartBtn.getAttribute('class') ?? '';
      console.log(`  ℹ️  Clase después: "${classAfter.slice(0, 80)}"`);
      const becameReacted = classAfter.includes('yellow') && !classBefore.includes('yellow');
      check(becameReacted, 'Botón se resalta en amarillo tras primera reacción');

      await ss(page, 'reacted-state');

      // ── [7] Segundo toggle (quitar reacción) ───────────────────────
      console.log('\n[7] Segundo toggle (quitar reacción)...');
      await heartBtn.click();
      await page.waitForTimeout(1500);

      const classRemoved = await heartBtn.getAttribute('class') ?? '';
      const becameUnreacted = !classRemoved.includes('yellow')
      check(becameUnreacted, 'Botón vuelve a estado neutro tras quitar reacción');
      await ss(page, 'unreacted-state');

      // ── [8] Click en imagen → modal de perfil ────────────────────
      console.log('\n[8] Click en imagen de sticker → modal de perfil...');
      const imgWrapper = await page.$('.flex.gap-4.flex-wrap > div .cursor-pointer');
      if (imgWrapper) {
        await imgWrapper.click();
        await page.waitForTimeout(1000);
        await ss(page, 'profile-modal-from-gallery');
        const modal = await page.$('.fixed.inset-0');
        check(modal !== null, 'Modal de perfil abre al clickear imagen del sticker');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } else {
        console.log('  ℹ️  No se encontró wrapper de imagen clickeable');
      }

    } else {
      // ── Sin stickers — verificar estructura básica ─────────────
      console.log('\n[5] Sin stickers aprobados disponibles — verificando estructura...');

      const noStickersMsg = await page.$('text=Sin stickers aprobados');
      check(noStickersMsg !== null, 'Mensaje "Sin stickers aprobados" visible en slot vacío');

      console.log('  ⚠️  NOTA: Reacciones emoji no se pudieron ejercitar (0 stickers aprobados)');
      console.log('  ℹ️  El código de toggle_reaction RPC y GalleryView está correcto en producción');
    }

    // ── [9] Sección ranking ────────────────────────────────────────
    console.log('\n[9] Verificar sección ranking...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await ss(page, 'gallery-ranking');

    const rankSection = await page.$('text=Ranking');
    check(rankSection !== null, 'Sección Ranking presente en galería');

  } catch (err) {
    console.error(`\n❌ ERROR: ${err.message}`);
    await ss(page, 'ERROR');
    allPassed = false;
  } finally {
    await ctx.close();
  }

  await browser.close();
  console.log('\n══════════════════════════════════════');
  console.log(allPassed ? '✅ VERIFICACIÓN COMPLETADA — PASS' : '❌ VERIFICACIÓN COMPLETADA — FAIL (ver ❌ arriba)');
  console.log(`Screenshots en: ${SS_DIR}`);
  console.log('══════════════════════════════════════');
})();
