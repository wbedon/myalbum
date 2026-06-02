import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const SHOTS = 'C:\Users\BEDONW\AppData\Local\Temp\verify_shots';

import { mkdirSync } from 'fs';
try { mkdirSync(SHOTS, { recursive: true }); } catch {}

// ── 1. Login page ────────────────────────────────────────────────
await page.goto('http://localhost:3000');
await page.screenshot({ path: `${SHOTS}/01_home.png`, fullPage: true });
console.log('01 home loaded:', page.url());

// ── 2. Admin panel – login first ─────────────────────────────────
// Fill login form if present
const emailInput = page.locator('input[type="email"]');
if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  await emailInput.fill('amceesystems@gmail.com');
  const passInput = page.locator('input[type="password"]');
  await passInput.fill('Mun2026!');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/02_after_login.png`, fullPage: true });
  console.log('02 after login:', page.url());
}

// ── 3. Navigate to admin panel – Portadas tab ────────────────────
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
await page.screenshot({ path: `${SHOTS}/03_dashboard.png`, fullPage: true });

// Click Portadas tab if visible
const portadasTab = page.locator('button', { hasText: /portadas/i });
if (await portadasTab.isVisible({ timeout: 3000 }).catch(() => false)) {
  await portadasTab.click();
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/04_portadas_tab.png`, fullPage: true });
  console.log('04 Portadas tab visible: OK');
} else {
  console.log('04 Portadas tab: NOT FOUND');
}

// ── 4. Check Plantillas tab still works ──────────────────────────
const plantillasTab = page.locator('button', { hasText: /plantillas/i });
if (await plantillasTab.isVisible({ timeout: 3000 }).catch(() => false)) {
  await plantillasTab.click();
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/05_plantillas_tab.png`, fullPage: true });
  console.log('05 Plantillas tab: OK');
}

// ── 5. Check Campañas – nueva campaña form has portada selectors ─
const campanasTab = page.locator('button', { hasText: /campañas/i });
if (await campanasTab.isVisible({ timeout: 3000 }).catch(() => false)) {
  await campanasTab.click();
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const newBtn = page.locator('button', { hasText: /nueva campaña/i });
  if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/06_nueva_campana_form.png`, fullPage: true });
    const portadaSelect = page.locator('select').first();
    const hasPortadaSelect = await portadaSelect.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('06 Portada selector in nueva-campaña form:', hasPortadaSelect ? 'FOUND' : 'NOT FOUND');
    // Count selects (should be 2: portada + contraportada)
    const selectCount = await page.locator('select').count();
    console.log('06 Total select elements in form:', selectCount);
  }
}

// ── 6. Public album page ─────────────────────────────────────────
// Try fetching a known public album ID from the API
const resp = await page.goto('http://localhost:3000');
// Grab any album link from dashboard
const albumLinks = await page.locator('a[href^="/album/"]').all();
console.log('Public album links found:', albumLinks.length);
if (albumLinks.length > 0) {
  const href = await albumLinks[0].getAttribute('href');
  await page.goto(`http://localhost:3000${href}`);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/07_public_album.png`, fullPage: true });
  console.log('07 public album page:', page.url());
  // Check if portada section exists
  const portadaImg = page.locator('img[alt*="Portada"]');
  const hasCover = await portadaImg.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('07 Portada image visible:', hasCover);
}

await browser.close();
console.log('DONE — screenshots at', SHOTS);
