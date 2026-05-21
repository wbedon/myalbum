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
 */

import type { SafeArea } from './supabase'

export type Transform = {
  x: number       // posición X del borde izquierdo del cutout (fracción 0–1 del ancho de la plantilla)
  y: number       // posición Y del borde superior  (fracción 0–1 del alto de la plantilla)
  width: number   // ancho del cutout (fracción 0–1, puede pasarse de 1 si se quiere agrandar)
}

export type ComposeOptions = {
  safeArea?: SafeArea | null
  transform?: Transform | null
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

  if (options?.transform) {
    return composeWithTransform(cutout, template, options.transform)
  }
  if (options?.safeArea) {
    return composeWithSafeArea(cutout, template, options.safeArea)
  }
  return composeCover(cutout, template)
}

/**
 * MODO TRANSFORM: canvas = plantilla nativa. Cutout dibujado en las
 * coordenadas exactas que indica el transform. La altura del cutout se
 * deriva del ancho preservando su aspect ratio original.
 */
function composeWithTransform(
  cutout: HTMLImageElement,
  template: HTMLImageElement,
  t: Transform
): Promise<Blob> {
  const tW = template.naturalWidth
  const tH = template.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = tW
  canvas.height = tH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  ctx.drawImage(template, 0, 0)

  const drawW = t.width * tW
  const drawH = drawW * (cutout.naturalHeight / cutout.naturalWidth)
  const drawX = t.x * tW
  const drawY = t.y * tH

  ctx.drawImage(cutout, drawX, drawY, drawW, drawH)

  return canvasToBlob(canvas)
}

/**
 * MODO SAFE AREA: canvas = plantilla nativa. Cutout escalado (contain) y
 * centrado horizontalmente dentro de la región segura, alineado arriba.
 */
function composeWithSafeArea(
  cutout: HTMLImageElement,
  template: HTMLImageElement,
  safeArea: SafeArea
): Promise<Blob> {
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
  const drawX = safeX + (safeW - drawW) / 2
  const drawY = safeY

  ctx.drawImage(cutout, drawX, drawY, drawW, drawH)

  return canvasToBlob(canvas)
}

/**
 * MODO COVER (original): canvas = tamaño del cutout, plantilla escalada
 * a "cover" detrás. Útil para fondos planos / paisajes.
 */
function composeCover(cutout: HTMLImageElement, template: HTMLImageElement): Promise<Blob> {
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

  return canvasToBlob(canvas)
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
