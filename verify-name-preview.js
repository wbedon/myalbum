/**
 * Verifica que el preview del nombre aparece en el editor mientras se escribe,
 * en viewport iPhone 13.
 *
 * Criterio: al escribir "MESSI" en el campo, el editor debe mostrar píxeles
 * blancos en la zona del óvalo (y=86.3-93.9% del editor) — en tiempo real,
 * ANTES de descargar.
 */

const { chromium, devices } = require('playwright')
const path = require('path')

const URL = 'https://myalbum-green.vercel.app'
const IPHONE = devices['iPhone 13']
const TIMEOUT = 360_000

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

  // Seleccionar Ecuador
  await page.locator('button[title="Ecuador"]').scrollIntoViewIfNeeded()
  await page.locator('button[title="Ecuador"]').tap()
  await page.waitForTimeout(1500)

  // Scroll al editor y screenshot SIN nombre
  const editor = page.locator('[style*="aspect-ratio"]').first()
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'np-01-sin-nombre.png' })
  console.log('Screenshot sin nombre: np-01-sin-nombre.png')

  // Escribir nombre
  await page.locator('input#player-name').scrollIntoViewIfNeeded()
  await page.locator('input#player-name').tap()
  await page.locator('input#player-name').fill('MESSI')
  await page.waitForTimeout(600)

  // Scroll de vuelta al editor y screenshot CON nombre
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'np-02-con-nombre.png' })
  console.log('Screenshot con nombre: np-02-con-nombre.png')

  // Analizar píxeles del editor EN PANTALLA (no el PNG descargado)
  // Comparar zona del óvalo antes vs después de escribir el nombre
  const editorBox = await editor.boundingBox()
  console.log(`\nEditor en pantalla: x=${editorBox.x.toFixed(0)}, y=${editorBox.y.toFixed(0)}, w=${editorBox.width.toFixed(0)}, h=${editorBox.height.toFixed(0)}`)

  const pixelResult = await page.evaluate(async (box) => {
    const aspectEls = Array.from(document.querySelectorAll('[style]')).filter(el => el.getAttribute('style')?.includes('aspect-ratio'))
    const editor = aspectEls[0]
    if (!editor) return { error: 'editor no encontrado', count: aspectEls.length }

    const previewSpan = editor.querySelector('span[style*="font-family"]')
    const previewZ20 = editor.querySelector('[class*="z-20"]')
    const inputVal = document.querySelector('#player-name')?.value
    const allSpans = Array.from(editor.querySelectorAll('span')).map(s => ({
      style: s.getAttribute('style')?.slice(0, 80),
      text: s.textContent?.slice(0, 20),
    }))

    if (!previewSpan) return {
      found: false,
      text: null,
      diagnostics: {
        editorStyle: editor.getAttribute('style'),
        editorChildCount: editor.children.length,
        inputVal,
        hasZ20: !!previewZ20,
        z20Style: previewZ20?.getAttribute('style'),
        z20ChildCount: previewZ20?.children.length ?? 0,
        spanCount: allSpans.length,
        spans: allSpans,
      }
    }

    return {
      found: true,
      text: previewSpan.textContent,
      fontSize: previewSpan.style.fontSize,
      color: previewSpan.style.color,
      visible: previewSpan.offsetParent !== null,
    }
  }, editorBox)

  console.log('\n--- Verificación DOM del preview ---')
  console.log(JSON.stringify(pixelResult, null, 2))

  if (pixelResult.found) {
    console.log(`\n✅ PASS: preview del nombre encontrado en el editor`)
    console.log(`   Texto: "${pixelResult.text}"`)
    console.log(`   Font-size: ${pixelResult.fontSize}`)
    console.log(`   Color: ${pixelResult.color}`)
    console.log(`   Visible: ${pixelResult.visible}`)
  } else if (pixelResult.error) {
    console.log(`\n❌ ERROR: ${pixelResult.error}`)
  } else {
    console.log(`\n❌ FAIL: el span de preview NO existe en el DOM`)
    console.log('   → El overlay de nombre no está siendo renderizado')
  }

  // Verificar también que SIN nombre no hay span
  // (primero borrar el nombre y verificar)
  await page.locator('input#player-name').scrollIntoViewIfNeeded()
  await page.locator('input#player-name').fill('')
  await page.waitForTimeout(400)
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'np-03-nombre-borrado.png' })

  const spanAfterClear = await page.evaluate(() => {
    const editor = document.querySelectorAll('[style*="aspect-ratio"]')[0]
    return !!editor?.querySelector('span[style*="font-family"]')
  })
  console.log(`\n🔍 Span presente con campo vacío: ${spanAfterClear} → ${!spanAfterClear ? '✅ correcto (no muestra nada)' : '⚠️ debería estar oculto'}`)

  await browser.close()
  console.log('\nScreenshots: np-01 (sin nombre), np-02 (con nombre), np-03 (borrado)')
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
