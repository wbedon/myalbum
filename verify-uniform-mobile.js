const { chromium, devices } = require('playwright')

const IPHONE = devices['iPhone 13']
const URL = 'https://myalbum-green.vercel.app'
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

  // ── Test 1: sin plantilla, el UniformPicker NO debe aparecer ──
  // Esperar que el TemplatePicker cargue (pasa de skeleton a <select>)
  await page.locator('select').first().waitFor({ state: 'visible', timeout: 10000 })
  const selectsBeforeTemplate = await page.locator('select').count()
  console.log(`\n── Sin plantilla ──`)
  console.log(`  Selects visibles: ${selectsBeforeTemplate} (esperado: 1 — solo template picker)`)
  console.log(`  ${selectsBeforeTemplate === 1 ? '✅' : '❌'} UniformPicker oculto sin plantilla`)

  await page.screenshot({ path: 'uniform-01-sin-plantilla.png' })

  // ── Test 2: seleccionar una plantilla → UniformPicker debe aparecer ──
  // El primer select es el TemplatePicker
  const templateOptionValue = await page.locator('select').first()
    .locator('option')
    .filter({ hasText: /Ecuador|Argentina|Brasil|Colombia|Venezuela/i })
    .first()
    .getAttribute('value')

  await page.locator('select').first().selectOption({ value: templateOptionValue ?? '' })
  await page.waitForTimeout(1500)

  const selectsAfterTemplate = await page.locator('select').count()
  const uniformPickerVisible = selectsAfterTemplate >= 2
  console.log(`\n── Con plantilla seleccionada ──`)
  console.log(`  Selects visibles: ${selectsAfterTemplate} (esperado: 2)`)
  console.log(`  ${uniformPickerVisible ? '✅' : '❌'} UniformPicker aparece con plantilla`)

  await page.screenshot({ path: 'uniform-02-con-plantilla.png' })

  // ── Test 3: verificar opciones del UniformPicker ──
  if (uniformPickerVisible) {
    const uniformOptions = await page.locator('select').nth(1).locator('option').allTextContents()
    console.log(`\n── Opciones del UniformPicker ──`)
    console.log(`  Cantidad: ${uniformOptions.length}`)
    uniformOptions.forEach((t, i) => console.log(`  [${i}] "${t.trim()}"`))
    const hasSinUniforme = uniformOptions.some(t => t.includes('Sin uniforme'))
    console.log(`  ${hasSinUniforme ? '✅' : '❌'} Opción "Sin uniforme" presente`)

    // ── Test 4: seleccionar un uniforme ──
    const firstUniformValue = await page.locator('select').nth(1)
      .locator('option')
      .nth(1) // índice 1 = primera opción real (0 = Sin uniforme)
      .getAttribute('value')

    if (firstUniformValue) {
      await page.locator('select').nth(1).selectOption({ value: firstUniformValue })
      await page.waitForTimeout(1000)
      console.log(`\n── Uniforme seleccionado ──`)
      console.log(`  ✅ Selección sin errores`)
      await page.screenshot({ path: 'uniform-03-uniforme-activo.png' })

      // Verificar que la capa de uniforme aparece en el DOM del editor
      const uniformLayerExists = await page.evaluate(() => {
        const editor = document.querySelector('[style*="aspect-ratio"]')
        if (!editor) return false
        const imgs = Array.from(editor.querySelectorAll('img'))
        // Hay al menos 3 imgs: template, uniform, cutout
        return imgs.length >= 3
      })
      console.log(`  ${uniformLayerExists ? '✅' : '❌'} Capa de uniforme en el editor (≥3 imágenes)`)

      // ── Test 5: volver a "Sin uniforme" ──
      await page.locator('select').nth(1).selectOption({ value: '' })
      await page.waitForTimeout(600)
      const uniformLayerGone = await page.evaluate(() => {
        const editor = document.querySelector('[style*="aspect-ratio"]')
        if (!editor) return true
        const imgs = Array.from(editor.querySelectorAll('img'))
        return imgs.length < 3
      })
      console.log(`  ${uniformLayerGone ? '✅' : '❌'} Capa de uniforme removida al volver a "Sin uniforme"`)
    }
  }

  const allPass = selectsBeforeTemplate === 1 && uniformPickerVisible
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Veredicto: ${allPass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: uniform-01, uniform-02, uniform-03')

  await browser.close()
  if (!allPass) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
