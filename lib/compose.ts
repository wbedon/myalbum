/**
 * Compone una imagen PNG con transparencia (cutout) sobre una plantilla.
 *
 * Tres modos de composición, en orden de prioridad:
 *
 * 1. Con `transform` explícito → el cutout se ubica exactamente donde el
 *    usuario lo posicionó/redimensionó en el editor.
 *
 * 2. Con `safeArea` → el cutout se ajusta automáticamente (contain) dentro
 *    de una región rectangular predefinida en la plantilla.
 *
 * 3. Modo "cover" (sin opciones) → el canvas toma el tamaño del cutout, la
 *    plantilla se escala a cubrir, y el cutout va encima a tamaño completo.
 *
 * Después de componer, si se proveen `playerName` + `nameBand`, se superpone
 * el nombre del jugador en la banda inferior del sticker.
 */

import type { SafeArea, NameBand } from './supabase'

export type Transform = {
  x: number       // posición X del borde izquierdo del cutout (fracción 0–1 del ancho de la plantilla)
  y: number       // posición Y del borde superior  (fracción 0–1 del alto de la plantilla)
  width: number   // ancho del cutout (fracción 0–1, puede pasarse de 1 si se quiere agrandar)
}

export type CropBox = {
  x: number  // fracción del ancho de la imagen (0–1)
  y: number  // fracción del alto de la imagen  (0–1)
  w: number  // fracción del ancho
  h: number  // fracción del alto
}

export type ComposeOptions = {
  safeArea?: SafeArea | null
  transform?: Transform | null
  crop?: CropBox | null
  playerName?: string | null
  nameBand?: NameBand | null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`))
    img.src = src
  })
}

export async function composeWithTemplate(
  cutoutUrl: string,
  templateUrl: string | null,
  options?: ComposeOptions
): Promise<Blob> {
  const cutout = await loadImage(cutoutUrl)

  if (!templateUrl) return blobFromImage(cutout)

  const template = await loadImage(templateUrl)

  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D

  if (options?.transform) {
    ;({ canvas, ctx } = buildWithTransform(cutout, template, options.transform, options.crop))
  } else if (options?.safeArea) {
    ;({ canvas, ctx } = buildWithSafeArea(cutout, template, options.safeArea))
  } else {
    ;({ canvas, ctx } = buildCover(cutout, template))
  }

  if (options?.playerName && options?.nameBand) {
    await overlayPlayerName(ctx, options.playerName, options.nameBand, canvas.width, canvas.height)
  }

  return canvasToBlob(canvas)
}

/**
 * MODO TRANSFORM: canvas = plantilla nativa. Cutout dibujado en las
 * coordenadas exactas que indica el transform. La altura del cutout se
 * deriva del ancho preservando su aspect ratio original.
 */
function buildWithTransform(
  cutout: HTMLImageElement,
  template: HTMLImageElement,
  t: Transform,
  crop?: CropBox | null
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const tW = template.naturalWidth
  const tH = template.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = tW
  canvas.height = tH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  ctx.drawImage(template, 0, 0)

  const fullDrawW = t.width * tW
  const fullDrawH = fullDrawW * (cutout.naturalHeight / cutout.naturalWidth)

  if (crop && (crop.x > 0 || crop.y > 0 || crop.w < 1 || crop.h < 1)) {
    const sx = crop.x * cutout.naturalWidth
    const sy = crop.y * cutout.naturalHeight
    const sw = crop.w * cutout.naturalWidth
    const sh = crop.h * cutout.naturalHeight
    const dx = t.x * tW + crop.x * fullDrawW
    const dy = t.y * tH + crop.y * fullDrawH
    ctx.drawImage(cutout, sx, sy, sw, sh, dx, dy, crop.w * fullDrawW, crop.h * fullDrawH)
  } else {
    ctx.drawImage(cutout, t.x * tW, t.y * tH, fullDrawW, fullDrawH)
  }

  return { canvas, ctx }
}

/**
 * MODO SAFE AREA: canvas = plantilla nativa. Cutout escalado (contain) y
 * centrado horizontalmente dentro de la región segura, alineado arriba.
 */
function buildWithSafeArea(
  cutout: HTMLImageElement,
  template: HTMLImageElement,
  safeArea: SafeArea
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const tW = template.naturalWidth
  const tH = template.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = tW
  canvas.height = tH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  ctx.drawImage(template, 0, 0)

  const safeX = safeArea.x * tW
  const safeY = safeArea.y * tH
  const safeW = safeArea.width * tW
  const safeH = safeArea.height * tH

  const scale = Math.min(safeW / cutout.naturalWidth, safeH / cutout.naturalHeight)
  const drawW = cutout.naturalWidth * scale
  const drawH = cutout.naturalHeight * scale
  ctx.drawImage(cutout, safeX + (safeW - drawW) / 2, safeY, drawW, drawH)

  return { canvas, ctx }
}

/**
 * MODO COVER (original): canvas = tamaño del cutout, plantilla escalada
 * a "cover" detrás. Útil para fondos planos / paisajes.
 */
function buildCover(
  cutout: HTMLImageElement,
  template: HTMLImageElement
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = cutout.naturalWidth
  canvas.height = cutout.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  const scale = Math.max(
    canvas.width / template.naturalWidth,
    canvas.height / template.naturalHeight
  )
  const tw = template.naturalWidth * scale
  const th = template.naturalHeight * scale
  ctx.drawImage(template, (canvas.width - tw) / 2, (canvas.height - th) / 2, tw, th)
  ctx.drawImage(cutout, 0, 0)

  return { canvas, ctx }
}

/**
 * Superpone el nombre del jugador en la banda del sticker.
 * Espera document.fonts.ready para garantizar que Anton esté disponible.
 */
async function overlayPlayerName(
  ctx: CanvasRenderingContext2D,
  name: string,
  band: NameBand,
  canvasW: number,
  canvasH: number
): Promise<void> {
  await document.fonts.ready

  const bx = band.x * canvasW
  const by = band.y * canvasH
  const bw = band.width * canvasW
  const bh = band.height * canvasH
  const fontSize = (band.font_size ?? 0.055) * canvasW
  const text = (band.uppercase ?? true) ? name.toUpperCase() : name

  ctx.save()
  ctx.font = `bold ${fontSize}px Anton, Impact, sans-serif`
  ctx.fillStyle = band.color ?? '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + bw / 2, by + bh / 2, bw * 0.92)
  ctx.restore()
}

function blobFromImage(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.drawImage(img, 0, 0)
  return canvasToBlob(canvas)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob falló'))),
      'image/png'
    )
  })
}
