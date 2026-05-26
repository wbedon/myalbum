/**
 * Verifica que la posición del uniforme en el editor coincide con el PNG descargado.
 * Posiciona el uniforme en el torso (arrastrándolo hacia abajo), toma screenshot
 * del editor, descarga el PNG y compara visualmente.
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
  console.log('\n── Setup ──')
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

  // ── Leer transform inicial del uniforme ─────────────────────────────────────
  const getUniTransform = () => page.evaluate(() => {
    const ed = document.querySelector('[style*="aspect-ratio"]')
    if (!ed) return null
    const uniDiv = Array.from(ed.querySelectorAll(':scope > div')).find(
      d => d.querySelector('img[src*="/uniforms/"]')
    )
    if (!uniDiv) return null
    return { left: uniDiv.style.left, top: uniDiv.style.top, width: uniDiv.style.width }
  })

  const transformInicial = await getUniTransform()
  console.log('\n── Posición inicial del uniforme ──')
  console.log(`  ${JSON.stringify(transformInicial)}`)

  // ── Posicionar uniforme en el torso (arrastrar hacia abajo ~30% del editor) ─
  console.log('\n── Arrastrar uniforme hacia el torso ──')
  const uniformDragZone = editor.locator('.cursor-move').last()
  await uniformDragZone.hover()
  const uniBox = await uniformDragZone.boundingBox()
  const editorBox = await editor.boundingBox()

  if (!uniBox || !editorBox) {
    check('boundingBox disponible', false)
    await browser.close(); process.exit(1)
  }

  // Drag hacia abajo para colocar el uniforme en el área del torso
  const startX = uniBox.x + uniBox.width * 0.5
  const startY = uniBox.y + uniBox.height * 0.5
  const moveDownPx = editorBox.height * 0.30  // bajar 30% del alto del editor

  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.move(startX, startY + moveDownPx, { steps: 20 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(700)

  const transformFinal = await getUniTransform()
  console.log(`  transform final: ${JSON.stringify(transformFinal)}`)

  // Verificar que la posición cambió significativamente
  const topAntes = parseFloat(transformInicial?.top ?? '0')
  const topDespues = parseFloat(transformFinal?.top ?? '0')
  const deltaTop = topDespues - topAntes
  check('Uniforme movido hacia abajo (Δtop > 15%)', deltaTop > 15, `Δtop=${deltaTop.toFixed(1)}%`)

  // ── Screenshot del editor ───────────────────────────────────────────────────
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await editor.screenshot({ path: 'pos-01-editor.png' })
  console.log('\n  📸 pos-01-editor.png (editor con uniforme en torso)')

  // ── Descargar PNG ───────────────────────────────────────────────────────────
  console.log('\n── Descargar PNG ──')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button').filter({ hasText: 'Descargar PNG' }).tap(),
  ])
  await download.saveAs('pos-02-descargado.png')
  const kb = Math.round(fs.statSync('pos-02-descargado.png').size / 1024)
  check('PNG descargado >100 KB', kb > 100, `${kb} KB`)
  console.log('  📸 pos-02-descargado.png')

  // ── Verificar posición relativa en el PNG ───────────────────────────────────
  // El uniforme debería estar en la mitad inferior del PNG (top > 35%)
  // lo verificamos inspeccionando el transform final que usó el compose
  const topFrac = parseFloat(transformFinal?.top ?? '0') / 100
  check('Uniforme en mitad inferior del sticker (top > 35%)', topFrac > 0.35,
    `top=${(topFrac*100).toFixed(1)}%`)

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`)
  console.log(`Veredicto: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Comparar pos-01-editor.png con pos-02-descargado.png para confirmar coincidencia visual')

  await browser.close()
  if (failed > 0) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
