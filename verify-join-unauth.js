const { chromium } = require('@playwright/test');
const path = require('path');
const SS_DIR = path.join(__dirname, 'verify-3a-screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const url = 'https://myalbum-green.vercel.app/unirse/c50a7a5a002f77f58fbae04473ef5821';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="password"], button:has-text("Unirme")', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(SS_DIR, '13-join-unauthenticated.png') });
  const loginInput = await page.$('input[placeholder*="usuario" i]');
  const unirmeBtn = await page.$('button:has-text("Unirme a la campaña")');
  console.log('login form visible:', !!loginInput);
  console.log('unirme button visible:', !!unirmeBtn);
  await browser.close();
})();
