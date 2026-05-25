'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Transform, CropBox } from '@/lib/compose'
import type { NameBand } from '@/lib/supabase'

type CropHandle = 'tl' | 'tr' | 'bl' | 't' | 'b' | 'l' | 'r'

interface Props {
  templateUrl: string
  cutoutUrl: string
  transform: Transform
  onTransformChange: (t: Transform) => void
  crop: CropBox
  onCropChange: (c: CropBox) => void
  playerName?: string
  nameBand?: NameBand | null
}

const MIN_CROP = 0.04

export default function CompositionEditor({
  templateUrl,
  cutoutUrl,
  transform,
  onTransformChange,
  crop,
  onCropChange,
  playerName,
  nameBand,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tplDims, setTplDims] = useState<{ w: number; h: number } | null>(null)
  const [cutDims, setCutDims] = useState<{ w: number; h: number } | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [tplDims, cutDims])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setTplDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = templateUrl
  }, [templateUrl])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setCutDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = cutoutUrl
  }, [cutoutUrl])

  // Drag: mueve el cutout (desplaza transform.x/y; crop no cambia)
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

  // Resize: escala el cutout desde la esquina inferior derecha (aspect ratio preservado)
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

  // Crop: ajusta qué porción de la imagen es visible
  const handleCropStart = useCallback(
    (type: CropHandle, e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = containerRef.current
      if (!container || !tplDims || !cutDims) return
      const rect = container.getBoundingClientRect()
      const startClientX = e.clientX
      const startClientY = e.clientY
      const startCrop = { ...crop }
      const templateAspect = tplDims.w / tplDims.h
      const cutoutAspect = cutDims.w / cutDims.h
      // Fracción del alto de la plantilla que ocupa la imagen completa (sin recorte)
      const hFrac = (transform.width * templateAspect) / cutoutAspect

      function onMove(ev: PointerEvent) {
        // Delta en fracción del contenedor → fracción de la imagen
        const dcx = ((ev.clientX - startClientX) / rect.width) / transform.width
        const dcy = ((ev.clientY - startClientY) / rect.height) / hFrac
        let { x, y, w, h } = startCrop
        const rx = x + w  // borde derecho fijo (para handles izquierdos)
        const by = y + h  // borde inferior fijo (para handles superiores)

        switch (type) {
          case 'tl': x = clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
          case 'tr': w=clamp(w+dcx,MIN_CROP,1-x);    y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
          case 'bl': x=clamp(x+dcx,0,rx-MIN_CROP);   w=rx-x; h=clamp(h+dcy,MIN_CROP,1-y); break
          case 't':  y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
          case 'b':  h=clamp(h+dcy,MIN_CROP,1-y); break
          case 'l':  x=clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; break
          case 'r':  w=clamp(w+dcx,MIN_CROP,1-x); break
        }
        onCropChange({ x, y, w, h })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [crop, transform, tplDims, cutDims, onCropChange]
  )

  if (!tplDims || !cutDims) {
    return <div className="aspect-[3/4] rounded-2xl bg-mundial-cream animate-pulse" />
  }

  const templateAspect = tplDims.w / tplDims.h
  const cutoutAspect = cutDims.w / cutDims.h
  // Altura de la imagen completa como fracción del alto del contenedor
  const heightFraction = (transform.width * templateAspect) / cutoutAspect

  const cropHandles: { id: CropHandle; cls: string; cursor: string; size: string }[] = [
    { id: 'tl', cls: '-top-2.5 -left-2.5',                     cursor: 'cursor-nwse-resize', size: 'w-5 h-5' },
    { id: 'tr', cls: '-top-2.5 -right-2.5',                    cursor: 'cursor-nesw-resize', size: 'w-5 h-5' },
    { id: 'bl', cls: '-bottom-2.5 -left-2.5',                  cursor: 'cursor-nesw-resize', size: 'w-5 h-5' },
    { id: 't',  cls: '-top-2.5 left-1/2 -translate-x-1/2',    cursor: 'cursor-n-resize',    size: 'w-4 h-4' },
    { id: 'b',  cls: '-bottom-2.5 left-1/2 -translate-x-1/2', cursor: 'cursor-s-resize',    size: 'w-4 h-4' },
    { id: 'l',  cls: '-left-2.5 top-1/2 -translate-y-1/2',    cursor: 'cursor-w-resize',    size: 'w-4 h-4' },
    { id: 'r',  cls: '-right-2.5 top-1/2 -translate-y-1/2',   cursor: 'cursor-e-resize',    size: 'w-4 h-4' },
  ]

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

      {/* Contenedor del cutout: cubre el tamaño COMPLETO de la imagen (sin recortar).
          La imagen se ve entera; las zonas fuera del recorte se oscurecen con overlays. */}
      <div
        className="absolute"
        style={{
          left:   `${transform.x * 100}%`,
          top:    `${transform.y * 100}%`,
          width:  `${transform.width * 100}%`,
          height: `${heightFraction * 100}%`,
        }}
      >
        {/* Imagen completa al 100% del contenedor */}
        <img
          src={cutoutUrl}
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
          draggable={false}
        />

        {/* Overlays oscuros: zonas FUERA del recorte (4 franjas sin gaps) */}
        <div className="absolute bg-black/50 pointer-events-none"
          style={{ left: 0, top: 0, right: 0, height: `${crop.y * 100}%` }} />
        <div className="absolute bg-black/50 pointer-events-none"
          style={{ left: 0, top: `${(crop.y + crop.h) * 100}%`, right: 0, bottom: 0 }} />
        <div className="absolute bg-black/50 pointer-events-none"
          style={{ left: 0, top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }} />
        <div className="absolute bg-black/50 pointer-events-none"
          style={{ left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%`, right: 0, height: `${crop.h * 100}%` }} />

        {/* Zona de arrastre: área visible (recortada), sin modificar tamaño de imagen */}
        <div
          className="absolute cursor-move touch-none"
          style={{
            left:   `${crop.x * 100}%`,
            top:    `${crop.y * 100}%`,
            width:  `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
          onPointerDown={handleDragStart}
        />

        {/* Borde punteado del área recortada */}
        <div
          className="absolute border-2 border-dashed border-mundial-green/80 pointer-events-none"
          style={{
            left:   `${crop.x * 100}%`,
            top:    `${crop.y * 100}%`,
            width:  `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        />

        {/* Handles de recorte: wrapper pointer-events-none → los handles reciben eventos,
            el área interior pasa los eventos al div de arrastre que está debajo */}
        <div
          className="absolute pointer-events-none"
          style={{
            left:   `${crop.x * 100}%`,
            top:    `${crop.y * 100}%`,
            width:  `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        >
          {cropHandles.map(({ id, cls, cursor, size }) => (
            <div
              key={id}
              onPointerDown={(e) => handleCropStart(id, e)}
              className={`absolute pointer-events-auto ${size} bg-white border-2 border-mundial-green rounded-sm shadow-md z-10 touch-none ${cls} ${cursor}`}
            />
          ))}
        </div>

        {/* Círculo de resize: esquina inferior-derecha de la imagen completa */}
        <div
          role="button"
          aria-label="Redimensionar"
          onPointerDown={handleResizeStart}
          className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-mundial-yellow border-2 border-mundial-green rounded-full cursor-nwse-resize shadow-md z-10 touch-none hover:scale-110 transition-transform"
        />
      </div>

      {/* Preview del nombre: se muestra en tiempo real mientras el usuario escribe */}
      {playerName && nameBand && containerWidth > 0 && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left:   `${nameBand.x * 100}%`,
            top:    `${nameBand.y * 100}%`,
            width:  `${nameBand.width * 100}%`,
            height: `${nameBand.height * 100}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Anton, Impact, sans-serif',
              fontSize: `${nameBand.font_size * containerWidth}px`,
              color: nameBand.color ?? '#FFFFFF',
              textTransform: (nameBand.uppercase ?? true) ? 'uppercase' : 'none',
              fontWeight: 'bold',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              letterSpacing: '0.02em',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            {(nameBand.uppercase ?? true) ? playerName.toUpperCase() : playerName}
          </span>
        </div>
      )}

      {/* Ayuda contextual */}
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
        <div className="inline-block text-[10px] font-semibold text-mundial-purple bg-mundial-yellow/90 px-2 py-1 rounded shadow-sm">
          Arrastrá para mover · handles blancos para recortar · círculo amarillo para redimensionar
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
