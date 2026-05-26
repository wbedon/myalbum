/**
 * Verifica que el uniforme es una capa interactiva encima del cutout:
 *  1. Uniforme visible como imagen separada (src=/uniforms/)
 *  2. Handles amarillos del uniforme (7 crop + borde punteado)
 *  3. Handles verdes del cutout también presentes (capas independientes)
 *  4. Resize circles diferenciados (verde/amarillo para uniforme, amarillo/verde para cutout)
 *  5. Drag del uniforme modifica su left/top en el DOM
 *  6. PNG descargado >100 KB (incluye uniforme en posición nueva)
 */

const { chromium, devices } = require('playwright')
const fs = require('fs')

const IPHONE  = devices['iPhone 13']
const URL     = 'https://myalbum-green.vercel.app'
const TIMEOUT = 360_000

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass })
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ ...IPHONE, locale: 'es-AR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(TIMEOUT)

  // ── Setup ───────────────────────────────────────────────────────────────────
  console.log('\n── Setup: Upload + AI ──')
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles('D:/PROYECTOS/wbfoto.jpg')
  console.log('  Esperando AI...')
  await page.locator('button').filter({ hasText: 'Descargar PNG' }).waitFor({ state: 'visible', timeout: TIMEOUT })
  console.log('  AI completo')

  const tplVal = await page.locator('select').first()
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').first().selectOption({ value: tplVal ?? '' })
  await page.waitForTimeout(1500)

  await page.locator('select').nth(1).waitFor({ state: 'visible' })
  const uniVal = await page.locator('select').nth(1)
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').nth(1).selectOption({ value: uniVal ?? '' })
  await page.waitForTimeout(1000)

  const editor = page.locator('[style*="aspect-ratio"]').first()

  // ── 1. Imágenes ─────────────────────────────────────────────────────────────
  console.log('\n── 1. Capa de uniforme ──')
  const imgSrcs = await editor.locator('img').evaluateAll(
    imgs => imgs.map(i => i.getAttribute('src') ?? '')
  )
  const uniformSrc = imgSrcs.find(s => s.includes('/uniforms/'))
  check('Imagen uniforme en el editor (/uniforms/)', !!uniformSrc, uniformSrc ?? 'no encontrado')
  check('≥3 imgs en editor (tpl+cutout+uniforme)', imgSrcs.length >= 3, `${imgSrcs.length} imgs`)

  // ── 2. Handles amarillos del uniforme ───────────────────────────────────────
  console.log('\n── 2. Handles amarillos del uniforme ──')
  const yellowHandles = await editor.locator('.border-mundial-yellow').count()
  const yellowBorder  = await editor.locator('[class*="border-dashed"][class*="border-mundial-yellow"]').count()
  check('Handles amarillos (≥7)', yellowHandles >= 7, `${yellowHandles} elementos`)
  check('Borde punteado amarillo', yellowBorder >= 1, `${yellowBorder} bordes`)

  // ── 3. Handles verdes del cutout ────────────────────────────────────────────
  console.log('\n── 3. Handles verdes del cutout ──')
  const greenHandles = await editor.locator('.border-mundial-green').count()
  check('Handles verdes del cutout (≥7)', greenHandles >= 7, `${greenHandles} elementos`)

  // ── 4. Resize circles ───────────────────────────────────────────────────────
  console.log('\n── 4. Resize circles ──')
  const uniResize = await editor.locator('.bg-mundial-green.border-mundial-yellow.rounded-full').count()
  const cutResize = await editor.locator('.bg-mundial-yellow.border-mundial-green.rounded-full').count()
  check('Resize circle uniforme (verde/amarillo)', uniResize >= 1, `${uniResize} circles`)
  check('Resize circle cutout (amarillo/verde)',   cutResize >= 1, `${cutResize} circles`)

  // Screenshot antes del drag
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await editor.screenshot({ path: 'uni-01-antes.png' })
  console.log('  📸 uni-01-antes.png')

  // ── 5. Drag del uniforme ────────────────────────────────────────────────────
  console.log('\n── 5. Drag del uniforme ──')

  const getUniStyle = () => page.evaluate(() => {
    const editor = document.querySelector('[style*="aspect-ratio"]')
    if (!editor) return null
    const uniDiv = Array.from(editor.querySelectorAll(':scope > div')).find(
      d => d.querySelector('img[src*="/uniforms/"]')
    )
    if (!uniDiv) return null
    return { left: uniDiv.style.left, top: uniDiv.style.top }
  })

  const styleBefore = await getUniStyle()
  console.log(`  style antes: ${JSON.stringify(styleBefore)}`)

  // Usar hover() en el drag zone del uniforme (último .cursor-move),
  // que hace scroll automático al elemento antes de interactuar.
  // Luego mouse.down+move+up para el drag.
  const uniformDragZone = editor.locator('.cursor-move').last()
  await uniformDragZone.hover()
  const uniBox = await uniformDragZone.boundingBox()
  if (uniBox) {
    console.log(`  uniformDragZone viewport box: ${JSON.stringify(uniBox)}`)
    const startX = uniBox.x + uniBox.width  * 0.5
    const startY = uniBox.y + uniBox.height * 0.5
    await page.mouse.down()
    await page.waitForTimeout(80)
    await page.mouse.move(startX + 60, startY + 45, { steps: 15 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(600)
  }

  const styleAfter = await getUniStyle()
  console.log(`  style después: ${JSON.stringify(styleAfter)}`)

  const moved = styleBefore && styleAfter &&
    (styleBefore.left !== styleAfter.left || styleBefore.top !== styleAfter.top)
  check('Drag mueve el uniforme (left/top cambia)', !!moved,
    `${styleBefore?.left}/${styleBefore?.top} → ${styleAfter?.left}/${styleAfter?.top}`)

  await editor.scrollIntoViewIfNeeded()
  await editor.screenshot({ path: 'uni-02-despues-drag.png' })
  console.log('  📸 uni-02-despues-drag.png')

  // ── 6. Descarga ─────────────────────────────────────────────────────────────
  console.log('\n── 6. Descarga PNG ──')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button').filter({ hasText: 'Descargar PNG' }).tap(),
  ])
  await download.saveAs('uni-03-descargado.png')
  const kb = Math.round(fs.statSync('uni-03-descargado.png').size / 1024)
  check('PNG descargado >100 KB', kb > 100, `${kb} KB`)
  console.log('  📸 uni-03-descargado.png')

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`)
  console.log(`Veredicto: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: uni-01 (antes drag), uni-02 (después drag), uni-03 (PNG)')

  await browser.close()
  if (failed > 0) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
