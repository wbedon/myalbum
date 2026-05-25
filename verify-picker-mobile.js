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

  // ── Test 1: el select existe y tiene las opciones esperadas ──
  const selectCount = await page.locator('select').count()
  console.log(`\n── Select ──`)
  console.log(`  Elementos <select> en la página: ${selectCount}`)

  const options = await page.locator('select option').allTextContents()
  console.log(`  Opciones (${options.length}):`)
  options.forEach((text, i) => console.log(`  [${i}] "${text.trim()}"`))

  const hasSinFondo  = options.some(t => t.includes('Sin fondo'))
  const hasArgentina = options.some(t => t.includes('Argentina'))
  const hasBrasil    = options.some(t => t.includes('Brasil'))
  const hasColombia  = options.some(t => t.includes('Colombia'))
  const hasEcuador   = options.some(t => t.includes('Ecuador'))
  const hasVenezuela = options.some(t => t.includes('Venezuela'))

  console.log(`\n── Opciones esperadas ──`)
  console.log(`  ${hasSinFondo  ? '✅' : '❌'} Sin fondo`)
  console.log(`  ${hasArgentina ? '✅' : '❌'} Argentina`)
  console.log(`  ${hasBrasil    ? '✅' : '❌'} Brasil`)
  console.log(`  ${hasColombia  ? '✅' : '❌'} Colombia`)
  console.log(`  ${hasEcuador   ? '✅' : '❌'} Ecuador`)
  console.log(`  ${hasVenezuela ? '✅' : '❌'} Venezuela`)

  // Screenshot inicial
  await page.screenshot({ path: 'picker-01-inicial.png' })

  // ── Test 2: seleccionar Ecuador ──
  const ecuadorOption = await page.locator('select option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').selectOption({ value: ecuadorOption ?? '' })
  await page.waitForTimeout(1500)

  const editorVisible = await page.locator('[style*="aspect-ratio"]').first().isVisible().catch(() => false)
  console.log(`\n── Selección Ecuador ──`)
  console.log(`  ${editorVisible ? '✅' : '❌'} Editor visible tras selección`)
  await page.screenshot({ path: 'picker-02-ecuador.png' })

  // ── Test 3: volver a "Sin fondo" ──
  await page.locator('select').selectOption({ value: '' })
  await page.waitForTimeout(800)
  const editorGone = !(await page.locator('[style*="aspect-ratio"]').first().isVisible().catch(() => false))
  console.log(`\n── Sin fondo ──`)
  console.log(`  ${editorGone ? '✅' : '❌'} Editor oculto al volver a "Sin fondo"`)
  await page.screenshot({ path: 'picker-03-sin-fondo.png' })

  const allPass = hasSinFondo && hasArgentina && hasBrasil && hasColombia && hasEcuador && hasVenezuela
    && editorVisible && editorGone
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Veredicto: ${allPass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: picker-01, picker-02, picker-03')

  await browser.close()
  if (!allPass) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
