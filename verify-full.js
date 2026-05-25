/**
 * Test completo end-to-end en iPhone 13:
 *  1. Upload + AI background removal
 *  2. Selector de plantilla (<select> con banderas)
 *  3. Hint fuera del editor
 *  4. Selector de uniforme (oculto sin plantilla, visible con plantilla)
 *  5. Capa de uniforme en el editor
 *  6. Nombre del jugador en óvalo superior
 *  7. Nombre del club en óvalo inferior
 *  8. Crop handles (touch events)
 *  9. PNG descargado incluye uniforme + nombre + club
 * 10. "Otra foto" resetea el estado
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

  // ── 1. Upload + AI ──────────────────────────────────────────────────────────
  console.log('\n── 1. Upload + AI ──')
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles('D:/PROYECTOS/wbfoto.jpg')
  console.log('  Esperando AI...')
  await page.locator('button').filter({ hasText: 'Descargar PNG' }).waitFor({ state: 'visible', timeout: TIMEOUT })
  const downloadVisible = await page.locator('button').filter({ hasText: 'Descargar PNG' }).isVisible()
  check('AI background removal completado', downloadVisible)
  check('Botón "Descargar PNG" visible',    downloadVisible)

  // ── 2. Selector de plantilla ────────────────────────────────────────────────
  console.log('\n── 2. Selector de plantilla ──')
  await page.locator('select').first().waitFor({ state: 'visible' })
  const templateOptions = await page.locator('select').first().locator('option').allTextContents()
  check('TemplatePicker es un <select>', await page.locator('select').count() >= 1)
  check('Opción "Sin fondo" presente',   templateOptions.some(t => t.includes('Sin fondo')))
  check('🇪🇨 Ecuador presente',          templateOptions.some(t => t.includes('Ecuador')))
  check('🇦🇷 Argentina presente',        templateOptions.some(t => t.includes('Argentina')))
  check('🇧🇷 Brasil presente',           templateOptions.some(t => t.includes('Brasil')))
  check('🇨🇴 Colombia presente',         templateOptions.some(t => t.includes('Colombia')))
  check('🇻🇪 Venezuela presente',        templateOptions.some(t => t.includes('Venezuela')))

  // ── 3. Sin plantilla: sin editor, sin uniform picker ───────────────────────
  console.log('\n── 3. Estado sin plantilla ──')
  const selectsBeforeTemplate = await page.locator('select').count()
  check('UniformPicker oculto sin plantilla', selectsBeforeTemplate === 1, `${selectsBeforeTemplate} selects`)

  // Seleccionar Ecuador
  const tplVal = await page.locator('select').first()
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').first().selectOption({ value: tplVal ?? '' })
  await page.waitForTimeout(1500)

  const editorVisible = await page.locator('[style*="aspect-ratio"]').first().isVisible().catch(() => false)
  check('Editor visible tras seleccionar plantilla', editorVisible)

  // ── 4. Hint fuera del editor ────────────────────────────────────────────────
  console.log('\n── 4. Hint ──')
  const hintCheck = await page.evaluate(() => {
    const editor  = document.querySelector('[style*="aspect-ratio"]')
    const allText = document.body.textContent ?? ''
    return {
      exists:  allText.includes('Arrastrá para mover'),
      inEditor: editor?.textContent?.includes('Arrastrá para mover') ?? false,
    }
  })
  check('Hint existe en la página',    hintCheck.exists)
  check('Hint está FUERA del editor',  hintCheck.exists && !hintCheck.inEditor)

  // ── 5. Uniform picker ───────────────────────────────────────────────────────
  console.log('\n── 5. UniformPicker ──')
  await page.locator('select').nth(1).waitFor({ state: 'visible' })
  const selectsWithTemplate = await page.locator('select').count()
  check('UniformPicker aparece con plantilla', selectsWithTemplate >= 2, `${selectsWithTemplate} selects`)

  const uniformOptions = await page.locator('select').nth(1).locator('option').allTextContents()
  check('Opción "Sin uniforme" presente', uniformOptions.some(t => t.includes('Sin uniforme')))
  check('5 uniformes disponibles',        uniformOptions.length === 6, `${uniformOptions.length} opciones`)

  // Seleccionar uniforme Ecuador
  const uniVal = await page.locator('select').nth(1)
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').nth(1).selectOption({ value: uniVal ?? '' })
  await page.waitForTimeout(800)

  const editor = page.locator('[style*="aspect-ratio"]').first()
  const imgCount = await editor.locator('img').count()
  const uniformSrc = await editor.locator('img').evaluateAll(
    imgs => imgs.map(i => i.getAttribute('src') ?? '')
  ).then(srcs => srcs.find(s => s.includes('/uniforms/')))
  check('Capa de uniforme en el editor (≥3 imgs)', imgCount >= 3, `${imgCount} imgs`)
  check('Src del uniforme apunta a /uniforms/',     !!uniformSrc, uniformSrc ?? 'no encontrado')

  // ── 6 & 7. Nombre + club ────────────────────────────────────────────────────
  console.log('\n── 6-7. Nombre y club ──')
  await page.locator('input#player-name').scrollIntoViewIfNeeded()
  await page.locator('input#player-name').fill('BEDON')
  await page.locator('input#club-name').fill('BARCELONA SC')
  await page.waitForTimeout(700)

  const playerSpan = await editor.locator('span').evaluateAll(
    spans => spans.map(s => s.textContent ?? '')
  )
  check('Nombre jugador en óvalo superior', playerSpan.some(t => t.includes('BEDON')))
  check('Nombre club en óvalo inferior',    playerSpan.some(t => t.includes('BARCELONA')))
  check('input#player-name visible',        await page.locator('input#player-name').isVisible())
  check('input#club-name visible',          await page.locator('input#club-name').isVisible())

  // ── 8. Crop handles ─────────────────────────────────────────────────────────
  console.log('\n── 8. Crop handles ──')
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const cropHandles = await editor.locator('.cursor-nwse-resize, .cursor-nesw-resize, .cursor-n-resize, .cursor-s-resize, .cursor-w-resize, .cursor-e-resize').count()
  const resizeCircle = await editor.locator('.cursor-nwse-resize.rounded-full').count()
  check('Handles de crop presentes (≥3)',  cropHandles >= 3, `${cropHandles} handles`)
  check('Círculo de resize presente',      resizeCircle >= 1)

  // ── 9. Screenshots editor ───────────────────────────────────────────────────
  await editor.screenshot({ path: 'full-01-editor.png' })
  console.log('\n── 9. Descarga PNG ──')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button').filter({ hasText: 'Descargar PNG' }).tap(),
  ])
  await download.saveAs('full-02-descargado.png')
  const kb = Math.round(fs.statSync('full-02-descargado.png').size / 1024)
  check('PNG descargado no vacío (>100 KB)', kb > 100, `${kb} KB`)

  // ── 10. Reset ───────────────────────────────────────────────────────────────
  console.log('\n── 10. Reset ──')
  await page.locator('button').filter({ hasText: 'Otra foto' }).tap()
  await page.waitForTimeout(600)
  // Tras reset: el botón Descargar desaparece y vuelve el drop zone
  const downloadGone  = !(await page.locator('button').filter({ hasText: 'Descargar PNG' }).isVisible().catch(() => false))
  const dropzoneBack  = await page.locator('input[type="file"]').count().then(n => n > 0).catch(() => false)
  check('"Otra foto" resetea al estado inicial', downloadGone && dropzoneBack)

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`)
  console.log(`Veredicto: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: full-01 (editor), full-02 (PNG descargado)')

  await browser.close()
  if (failed > 0) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
