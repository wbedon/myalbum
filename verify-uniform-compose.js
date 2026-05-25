const { chromium, devices } = require('playwright')
const fs = require('fs')

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

  // Esperar TemplatePicker y seleccionar Ecuador
  await page.locator('select').first().waitFor({ state: 'visible' })
  const templateValue = await page.locator('select').first()
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').first().selectOption({ value: templateValue ?? '' })
  await page.waitForTimeout(1500)

  // Esperar UniformPicker y seleccionar Ecuador
  await page.locator('select').nth(1).waitFor({ state: 'visible' })
  const uniformValue = await page.locator('select').nth(1)
    .locator('option').filter({ hasText: 'Ecuador' }).getAttribute('value')
  await page.locator('select').nth(1).selectOption({ value: uniformValue ?? '' })
  await page.waitForTimeout(1000)

  // Screenshot del editor con uniforme
  const editor = page.locator('[style*="aspect-ratio"]').first()
  await editor.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await editor.screenshot({ path: 'compose-01-editor-con-uniforme.png' })
  console.log('\n── Editor ──')
  console.log('  Screenshot: compose-01-editor-con-uniforme.png')

  // Verificar capas en el DOM (template + uniform + cutout = ≥3 imgs)
  const imgCount = await editor.locator('img').count()
  console.log(`  Imágenes en editor: ${imgCount} (esperado ≥3: template + uniforme + cutout)`)
  console.log(`  ${imgCount >= 3 ? '✅' : '❌'} Capas correctas`)

  // Verificar que el src del uniforme apunta al PNG real
  const imgSrcs = await editor.locator('img').evaluateAll(
    (imgs) => imgs.map(img => img.getAttribute('src') ?? '')
  )
  const uniformSrc = imgSrcs.find(s => s.includes('/uniforms/'))
  console.log(`  Uniforme src: ${uniformSrc ?? '(no encontrado)'}`)
  console.log(`  ${uniformSrc ? '✅' : '❌'} Imagen real del uniforme cargada`)

  // Descargar el PNG final e inspeccionar
  console.log('\n── Descarga ──')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button').filter({ hasText: 'Descargar PNG' }).tap(),
  ])
  const downloadPath = 'compose-02-descargado.png'
  await download.saveAs(downloadPath)

  const fileSize = fs.statSync(downloadPath).size
  const fileSizeKb = Math.round(fileSize / 1024)
  console.log(`  Archivo: ${downloadPath}`)
  console.log(`  Tamaño: ${fileSizeKb} KB`)
  console.log(`  ${fileSizeKb > 50 ? '✅' : '❌'} PNG no vacío (>${50} KB)`)

  // Screenshot de página completa para contexto visual
  await page.screenshot({ path: 'compose-03-pagina.png' })

  const allPass = imgCount >= 3 && !!uniformSrc && fileSizeKb > 50
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Veredicto: ${allPass ? '✅ PASS' : '❌ FAIL'}`)
  console.log('Screenshots: compose-01 (editor), compose-02 (PNG final), compose-03 (página)')

  await browser.close()
  if (!allPass) process.exit(1)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
