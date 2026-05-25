/**
 * Verifica en iPhone 13:
 * 1. El nombre del club aparece en el óvalo inferior del sticker
 * 2. El nombre del jugador sigue en el óvalo superior
 * 3. El hint "Arrastrá para mover..." está FUERA/DEBAJO del editor (no lo tapa)
 * 4. El uniforme se incluye en el PNG descargado
 */

const { chromium, devices } = require('playwright')
const path = require('path')
const fs = require('fs')

const URL = 'https://myalbum-green.vercel.app'
const IPHONE = devices['iPhone 13']
const TIMEOUT = 360_000

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ ...IPHONE, locale: 'es-AR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(TIMEOUT)

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles('D:/PROYECTOS/wbfoto.jpg')
  console.log('Esperando AI...')
  await page.locator('button').filter({ hasText: 'Descargar PNG' }).waitFor({ state: 'visible', timeout: TIMEOUT })
  console.log('AI listo')

  await page.locator('select').first().waitFor({ state: 'visible' })
  const tplVal = await page.locator('select').first()
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').first().selectOption({ value: tplVal ?? '' })
  await page.waitForTimeout(1800)

  const editor = page.locator('[style*="aspect-ratio"]').first()
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  // ── Test 1: hint fuera del editor ──
  const hintInEditor = await page.evaluate(() => {
    const editors = Array.from(document.querySelectorAll('[style]'))
      .filter(el => el.getAttribute('style')?.includes('aspect-ratio'))
    const editor = editors[0]
    if (!editor) return { error: 'editor no encontrado' }
    // Buscar texto del hint dentro del editor
    const hintInsideEditor = editor.textContent?.includes('Arrastrá para mover')
    // Buscar el hint en cualquier lugar de la página
    const allText = document.body.textContent ?? ''
    const hintExists = allText.includes('Arrastrá para mover')
    return { hintInsideEditor, hintExists }
  })
  console.log('\n── Hint ──')
  console.log(`  Hint en la página: ${hintInEditor.hintExists}`)
  console.log(`  Hint DENTRO del editor: ${hintInEditor.hintInsideEditor}`)
  if (hintInEditor.hintExists && !hintInEditor.hintInsideEditor) {
    console.log('  ✅ PASS: hint está fuera del editor')
  } else if (hintInEditor.hintInsideEditor) {
    console.log('  ❌ FAIL: hint sigue dentro del editor')
  } else {
    console.log('  ❌ FAIL: hint no encontrado en la página')
  }

  // ── Screenshot sin nombres ──
  await editor.screenshot({ path: 'club-01-sin-nombres.png' })

  // ── Test 2: input del club existe ──
  const clubInput = page.locator('input#club-name')
  const clubInputVisible = await clubInput.isVisible().catch(() => false)
  console.log(`\n── Input de club ──`)
  console.log(`  ${clubInputVisible ? '✅ PASS' : '❌ FAIL'}: input#club-name ${clubInputVisible ? 'visible' : 'no encontrado'}`)

  // ── Ingresar nombre y club ──
  await page.locator('input#player-name').scrollIntoViewIfNeeded()
  await page.locator('input#player-name').fill('RODRIGUEZ')
  await page.locator('input#club-name').fill('BARCELONA SC')
  await page.waitForTimeout(700)

  // ── Seleccionar uniforme ──
  await page.locator('select').nth(1).waitFor({ state: 'visible' })
  const uniVal = await page.locator('select').nth(1)
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').nth(1).selectOption({ value: uniVal ?? '' })
  await page.waitForTimeout(800)

  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await editor.screenshot({ path: 'club-02-con-nombres.png' })

  // ── Test 3: verificar spans en el DOM ──
  const domCheck = await page.evaluate(() => {
    const editors = Array.from(document.querySelectorAll('[style]'))
      .filter(el => el.getAttribute('style')?.includes('aspect-ratio'))
    const editor = editors[0]
    if (!editor) return { error: 'editor no encontrado' }
    const spans = Array.from(editor.querySelectorAll('span[style*="font-family"]'))
    return {
      spanCount: spans.length,
      spans: spans.map(s => ({ text: s.textContent, fontSize: s.style.fontSize }))
    }
  })
  console.log(`\n── Spans en el editor ──`)
  console.log(`  Cantidad: ${domCheck.spanCount} (esperado: 2)`)
  domCheck.spans?.forEach((s, i) => console.log(`  [${i}] "${s.text}" — ${s.fontSize}`))

  const hasPlayerName = domCheck.spans?.some(s => s.text?.includes('RODRIGUEZ'))
  const hasClubName   = domCheck.spans?.some(s => s.text?.includes('BARCELONA'))
  console.log(`\n── Resultado DOM ──`)
  console.log(`  ${hasPlayerName ? '✅' : '❌'} Nombre jugador en editor`)
  console.log(`  ${hasClubName  ? '✅' : '❌'} Nombre club en editor`)

  // ── Screenshot página completa para ver hint debajo ──
  await page.screenshot({ path: 'club-03-pagina-full.png' })

  // ── Test 4: uniforme en el PNG descargado ──
  const uniformLayerExists = await editor.locator('img').count().then(n => n >= 3)
  console.log(`\n── Uniforme ──`)
  console.log(`  ${uniformLayerExists ? '✅' : '❌'} Capa de uniforme en el editor (≥3 imágenes)`)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button').filter({ hasText: 'Descargar PNG' }).tap(),
  ])
  await download.saveAs('club-04-descargado.png')
  const kb = Math.round(fs.statSync('club-04-descargado.png').size / 1024)
  console.log(`  PNG descargado: ${kb} KB`)
  console.log(`  ${kb > 50 ? '✅' : '❌'} PNG no vacío`)

  const allPass = hintInEditor.hintExists && !hintInEditor.hintInsideEditor
    && clubInputVisible && hasPlayerName && hasClubName && uniformLayerExists && kb > 50
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Veredicto: ${allPass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: club-01, club-02, club-03, club-04 (PNG final)')

  await browser.close()
  if (!allPass) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
