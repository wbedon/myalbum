/**
 * Verifica en viewport iPhone 13 que:
 * 1. Los handles de lado/esquina (blancos) SOLO recortan: el div contenedor
 *    de la imagen no cambia de tamaño.
 * 2. El círculo amarillo SÍ cambia el tamaño de la imagen.
 */

const { chromium, devices } = require('playwright')
const path = require('path')

const URL = 'https://myalbum-green.vercel.app'
const IPHONE = devices['iPhone 13']
const TIMEOUT = 360_000

function getCutoutWidth(page) {
  return page.evaluate(() => {
    const editors = Array.from(document.querySelectorAll('[style]')).filter(
      el => el.getAttribute('style')?.includes('aspect-ratio')
    )
    const editor = editors[0]
    if (!editor) return null
    const cutoutDiv = Array.from(editor.children).find(
      el => el.tagName === 'DIV' && el.getAttribute('style')?.includes('left:')
    )
    return cutoutDiv ? cutoutDiv.offsetWidth : null
  })
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ ...IPHONE, locale: 'es-AR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(TIMEOUT)

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles(
    path.join(__dirname, 'public', 'templates', 'argentina.jpg')
  )
  console.log('Esperando AI...')
  await page.locator('button').filter({ hasText: 'Descargar PNG' }).waitFor({ state: 'visible', timeout: TIMEOUT })
  console.log('AI listo')

  await page.locator('button[title="Ecuador"]').scrollIntoViewIfNeeded()
  await page.locator('button[title="Ecuador"]').tap()
  await page.waitForTimeout(1500)

  const editor = page.locator('[style*="aspect-ratio"]').first()
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'crop-01-inicial.png' })

  const widthBefore = await getCutoutWidth(page)
  console.log(`\nCutout width inicial: ${widthBefore}px`)

  // ── Test 1: handle derecho (cursor-e-resize) ──
  // Localizar el handle R directamente por su clase
  const handleR = page.locator('.cursor-e-resize').first()
  const rBox = await handleR.boundingBox()
  console.log(`Handle R: x=${rBox?.x?.toFixed(0)} y=${rBox?.y?.toFixed(0)} w=${rBox?.width?.toFixed(0)} h=${rBox?.height?.toFixed(0)}`)

  if (rBox) {
    const cx = rBox.x + rBox.width / 2
    const cy = rBox.y + rBox.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(cx - 40, cy, { steps: 8 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(400)
  }

  const widthAfterR = await getCutoutWidth(page)
  await page.screenshot({ path: 'crop-02-handle-R.png' })
  const rOk = Math.abs((widthAfterR ?? 0) - (widthBefore ?? 0)) < 5
  console.log(`\n[Handle R - drag izquierda 40px]`)
  console.log(`  Cutout width: ${widthBefore}px → ${widthAfterR}px`)
  console.log(`  ${rOk ? '✅ PASS' : '❌ FAIL'}: tamaño ${rOk ? 'NO cambió (solo recortó)' : 'CAMBIÓ — bug de resize'}`)

  // ── Test 2: handle superior (cursor-n-resize) ──
  const handleT = page.locator('.cursor-n-resize').first()
  const tBox = await handleT.boundingBox()
  console.log(`\nHandle T: x=${tBox?.x?.toFixed(0)} y=${tBox?.y?.toFixed(0)} w=${tBox?.width?.toFixed(0)} h=${tBox?.height?.toFixed(0)}`)

  if (tBox) {
    const cx = tBox.x + tBox.width / 2
    const cy = tBox.y + tBox.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(cx, cy + 35, { steps: 8 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(400)
  }

  const widthAfterT = await getCutoutWidth(page)
  await page.screenshot({ path: 'crop-03-handle-T.png' })
  const tOk = Math.abs((widthAfterT ?? 0) - (widthBefore ?? 0)) < 5
  console.log(`[Handle T - drag abajo 35px]`)
  console.log(`  Cutout width: ${widthBefore}px → ${widthAfterT}px`)
  console.log(`  ${tOk ? '✅ PASS' : '❌ FAIL'}: tamaño ${tOk ? 'NO cambió (solo recortó)' : 'CAMBIÓ — bug de resize'}`)

  // ── Test 3: esquina inferior-izquierda (cursor-nesw-resize = bl) ──
  const handleBL = page.locator('.cursor-nesw-resize').first()
  const blBox = await handleBL.boundingBox()
  console.log(`\nHandle BL: x=${blBox?.x?.toFixed(0)} y=${blBox?.y?.toFixed(0)}`)

  if (blBox) {
    const cx = blBox.x + blBox.width / 2
    const cy = blBox.y + blBox.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(cx + 30, cy - 20, { steps: 8 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(400)
  }

  const widthAfterBL = await getCutoutWidth(page)
  await page.screenshot({ path: 'crop-04-handle-BL.png' })
  const blOk = Math.abs((widthAfterBL ?? 0) - (widthBefore ?? 0)) < 5
  console.log(`[Handle BL - drag diag]`)
  console.log(`  Cutout width: ${widthBefore}px → ${widthAfterBL}px`)
  console.log(`  ${blOk ? '✅ PASS' : '❌ FAIL'}: tamaño ${blOk ? 'NO cambió (solo recortó)' : 'CAMBIÓ — bug de resize'}`)

  // ── Test 4: círculo amarillo → DEBE cambiar tamaño ──
  const yellowCircle = page.locator('[aria-label="Redimensionar"]').first()
  const circleBox = await yellowCircle.boundingBox()
  console.log(`\nCírculo resize: x=${circleBox?.x?.toFixed(0)} y=${circleBox?.y?.toFixed(0)}`)

  if (circleBox) {
    const cx = circleBox.x + circleBox.width / 2
    const cy = circleBox.y + circleBox.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(cx + 25, cy + 25, { steps: 8 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(400)
  }

  const widthAfterCircle = await getCutoutWidth(page)
  await page.screenshot({ path: 'crop-05-circulo-resize.png' })
  const circleOk = (widthAfterCircle ?? 0) > (widthBefore ?? 0) + 5
  console.log(`[Círculo amarillo - drag +25,+25]`)
  console.log(`  Cutout width: ${widthBefore}px → ${widthAfterCircle}px`)
  console.log(`  ${circleOk ? '✅ PASS' : '❌ FAIL'}: el círculo ${circleOk ? 'SÍ redimensionó' : 'NO redimensionó'}`)

  // ── Resumen ──
  const allPass = rOk && tOk && blOk && circleOk
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Veredicto: ${allPass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: crop-01..05')

  await browser.close()
  if (!allPass) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
