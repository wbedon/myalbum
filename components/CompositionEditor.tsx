'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Transform } from '@/lib/compose'

interface Props {
  templateUrl: string
  cutoutUrl: string
  transform: Transform
  onTransformChange: (t: Transform) => void
}

/**
 * Editor visual: muestra la plantilla con el cutout encima, ambos
 * en posiciones reales. El usuario puede arrastrar el cutout para
 * moverlo y usar el handle de la esquina inferior derecha para
 * redimensionarlo (manteniendo la proporción original).
 *
 * El editor NO genera la imagen final — solo mantiene el `transform`
 * actualizado. La composición real ocurre en composeWithTemplate
 * cuando el usuario descarga.
 */
export default function CompositionEditor({
  templateUrl,
  cutoutUrl,
  transform,
  onTransformChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tplDims, setTplDims] = useState<{ w: number; h: number } | null>(null)
  const [cutDims, setCutDims] = useState<{ w: number; h: number } | null>(null)

  // Carga dimensiones reales de la plantilla
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setTplDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = templateUrl
  }, [templateUrl])

  // Carga dimensiones reales del cutout
  useEffect(() => {
    const img = new Image()
    img.onload = () => setCutDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = cutoutUrl
  }, [cutoutUrl])

  // Drag: mover el cutout
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const startClientX = e.clientX
      const startClientY = e.clientY
      const startX = transform.x
      const startY = transform.y

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - startClientX) / rect.width
        const dy = (ev.clientY - startClientY) / rect.height
        onTransformChange({
          x: clamp(startX + dx, -0.5, 1.5),
          y: clamp(startY + dy, -0.5, 1.5),
          width: transform.width,
        })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [transform.x, transform.y, transform.width, onTransformChange]
  )

  // Resize desde la esquina inferior derecha (mantiene aspect ratio)
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const startClientX = e.clientX
      const startWidth = transform.width

      function onMove(ev: PointerEvent) {
        // Sensibilidad x2: 1 px de movimiento = 2px del ancho del template
        const dx = ((ev.clientX - startClientX) / rect.width) * 1.5
        const newWidth = clamp(startWidth + dx, 0.1, 2)
        onTransformChange({ x: transform.x, y: transform.y, width: newWidth })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [transform, onTransformChange]
  )

  if (!tplDims || !cutDims) {
    return <div className="aspect-[3/4] rounded-2xl bg-mundial-cream animate-pulse" />
  }

  const templateAspect = tplDims.w / tplDims.h
  const cutoutAspect = cutDims.w / cutDims.h

  // Altura del cutout como fracción del alto del contenedor.
  // Derivación: drawH (px en template) = drawW / cutoutAspect
  //             drawH / tH = (transform.width * tW / cutoutAspect) / tH
  //                        = transform.width * templateAspect / cutoutAspect
  const heightFraction = (transform.width * templateAspect) / cutoutAspect

  return (
    <div
      ref={containerRef}
      className="relative bg-mundial-cream rounded-2xl overflow-hidden select-none touch-none border-2 border-mundial-purple/10"
      style={{ aspectRatio: `${tplDims.w} / ${tplDims.h}` }}
    >
      {/* Plantilla de fondo */}
      <img
        src={templateUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Cutout arrastrable */}
      <div
        className="absolute cursor-move outline-2 outline-dashed outline-mundial-green/80 outline-offset-2 hover:outline-mundial-green"
        style={{
          left: `${transform.x * 100}%`,
          top: `${transform.y * 100}%`,
          width: `${transform.width * 100}%`,
          height: `${heightFraction * 100}%`,
        }}
        onPointerDown={handleDragStart}
      >
        <img
          src={cutoutUrl}
          alt=""
          className="w-full h-full pointer-events-none"
          draggable={false}
        />

        {/* Handle de resize en la esquina inferior derecha */}
        <div
          role="button"
          aria-label="Redimensionar"
          onPointerDown={handleResizeStart}
          className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-mundial-yellow border-2 border-mundial-green rounded-full cursor-nwse-resize shadow-md hover:scale-110 transition-transform"
        />
      </div>

      {/* Ayuda contextual */}
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
        <div className="inline-block text-[10px] font-semibold text-mundial-purple bg-mundial-yellow/90 px-2 py-1 rounded shadow-sm">
          Arrastrá para mover · esquina amarilla para redimensionar
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
