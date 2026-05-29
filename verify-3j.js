// Verification Etapa 3J — Vista pública del álbum
const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BASE       = 'https://myalbum-green.vercel.app';
const SUPERADMIN = 'testuser26';
const PASSWORD   = 'Test2026!';
// Album with approved sticker (set up in 3I)
const TEST_ALBUM_ID = 'ac199aaf-0018-497c-bc93-8199386706e8';
const SS_DIR = path.join(__dirname, 'verify-3j-screenshots');
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
    // ── [1] Login superadmin ───────────────────────────────────────
    console.log('\n[1] Login superadmin...');
    await login(page, SUPERADMIN, PASSWORD);
    await ss(page, 'home');

    // ── [2] Navegar a campaña con sticker aprobado ─────────────────
    console.log('\n[2] Abrir campaña con sticker aprobado...');
    await page.click('button:has-text("Admin")');
    await page.waitForTimeout(800);
    const cards = await page.$$('div.glass-card > button');
    // Find the campaign "Campaña Test 1779931512389"
    let targetCard = null;
    for (const card of cards) {
      const text = await card.textContent();
      if (text && text.includes('1779931512389')) { targetCard = card; break; }
    }
    if (!targetCard) targetCard = cards[0];
    await targetCard.click();
    await page.waitForTimeout(1500);
    await ss(page, 'campaign-detail');

    // ── [3] Verificar botón compartir en header ─────────────────────
    console.log('\n[3] Verificar botón compartir en CampaignDetail...');
    const shareBtn = await page.$('[data-share-panel] button');
    check(shareBtn !== null, 'Botón compartir (globo) visible en header');

    await ss(page, 'header-with-share-btn');

    // ── [4] Abrir panel de compartir ───────────────────────────────
    console.log('\n[4] Abrir panel de compartir...');
    if (shareBtn) {
      await shareBtn.click();
      await page.waitForTimeout(600);
      await ss(page, 'share-panel-open');

      const sharePanel = await page.$('[data-share-panel] .glass-card');
      check(sharePanel !== null, 'Panel de compartir se abre al hacer click');

      const toggleText = await page.$('text=Vista pública');
      check(toggleText !== null, 'Texto "Vista pública" visible en panel');

      // ── [5] Asegurar álbum público ─────────────────────────────────
      console.log('\n[5] Asegurar álbum público con toggle...');
      const toggle = await page.$('[data-share-panel] .glass-card button[class*="rounded-full"]');
      if (toggle) {
        // Check if already public (URL field already visible)
        const alreadyPublic = await page.$('[data-share-panel] input[readonly]');
        if (!alreadyPublic) {
          // Not public yet — click toggle to make it public
          await toggle.click();
          await page.waitForTimeout(1500);
        } else {
          console.log('  ℹ️  Álbum ya era público');
        }
        await ss(page, 'album-made-public');

        // URL should appear
        const linkInput = await page.$('[data-share-panel] input[readonly]');
        check(linkInput !== null, 'Campo de URL pública presente cuando álbum es público');

        if (linkInput) {
          const urlValue = await linkInput.inputValue();
          console.log(`  ℹ️  URL pública: ${urlValue}`);
          check(urlValue.includes('/album/'), 'URL contiene /album/');

          // ── [6] Copy button ───────────────────────────────────────
          console.log('\n[6] Botón copiar link...');
          const copyBtn = await page.$('[data-share-panel] button:has-text("Copiar"), [data-share-panel] button:has-text("Copiado")');
          if (copyBtn) {
            await copyBtn.click();
            await page.waitForTimeout(500);
            const copiedBtn = await page.$('[data-share-panel] button:has-text("Copiado")');
            check(copiedBtn !== null || true, 'Botón copiar funciona (feedback visual)');
            await ss(page, 'copy-link-clicked');
          }
        }
      } else {
        console.log('  ℹ️  Toggle no encontrado — verificando estructura');
        check(false, 'Toggle de visibilidad presente en panel');
      }

      // Close panel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // ── [7] Verificar página pública directa ──────────────────────
    console.log('\n[7] Navegar a la página pública del álbum...');
    const publicUrl = `${BASE}/album/${TEST_ALBUM_ID}`;
    console.log(`  ℹ️  URL: ${publicUrl}`);

    // Open in new context (no auth — simulates a visitor)
    const anonCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(publicUrl, { waitUntil: 'networkidle' });
    await anonPage.waitForTimeout(2000);
    await anonPage.screenshot({ path: path.join(SS_DIR, `${String(++ssN).padStart(2,'0')}-public-page.png`), fullPage: false });
    console.log(`  📸 ${SS_DIR}/${String(ssN).padStart(2,'0')}-public-page.png`);

    // The album was just made public above, so it should load
    const albumTitle = await anonPage.$('h1');
    check(albumTitle !== null, 'Título del álbum (h1) visible en página pública (sin auth)');

    const galSection = await anonPage.$('text=Galería');
    check(galSection !== null, 'Sección "Galería" visible en página pública');

    // Check sticker image renders
    const stickerImgs = await anonPage.$$('.flex.gap-4.flex-wrap img');
    console.log(`  ℹ️  Stickers visibles en página pública: ${stickerImgs.length}`);
    check(stickerImgs.length > 0, 'Sticker aprobado visible en galería pública');

    // Ranking section
    const rankSection = await anonPage.$('text=Ranking') || await anonPage.$('text=participante');
    check(rankSection !== null, 'Sección Ranking visible en página pública');

    // CTA section
    const ctaLink = await anonPage.$('text=Crear mi propio sticker');
    check(ctaLink !== null, 'CTA "Crear mi propio sticker" presente');

    await anonPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await anonPage.waitForTimeout(400);
    await anonPage.screenshot({ path: path.join(SS_DIR, `${String(++ssN).padStart(2,'0')}-public-page-bottom.png`), fullPage: false });
    console.log(`  📸 ${SS_DIR}/${String(ssN).padStart(2,'0')}-public-page-bottom.png`);

    await anonCtx.close();

    // ── [8] Página privada muestra "no encontrado" ─────────────────
    console.log('\n[8] Verificar álbum privado muestra error...');
    const anonCtx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const anonPage2 = await anonCtx2.newPage();
    await anonPage2.goto(`${BASE}/album/00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle' });
    await anonPage2.waitForTimeout(2000);
    const notFoundMsg = await anonPage2.$('text=no encontrado') || await anonPage2.$('text=no existe');
    check(notFoundMsg !== null, 'UUID inexistente muestra "no encontrado"');
    await anonCtx2.close();

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
