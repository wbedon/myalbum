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
  clubName?: string
  clubBand?: NameBand | null
  // Capa de uniforme — interactiva, encima del cutout
  uniformUrl?: string
  uniformTransform?: Transform
  onUniformTransformChange?: (t: Transform) => void
  uniformCrop?: CropBox
  onUniformCropChange?: (c: CropBox) => void
}

const MIN_CROP = 0.04

const CROP_HANDLES: { id: CropHandle; cls: string; cursor: string; size: string }[] = [
  { id: 'tl', cls: '-top-2.5 -left-2.5',                     cursor: 'cursor-nwse-resize', size: 'w-5 h-5' },
  { id: 'tr', cls: '-top-2.5 -right-2.5',                    cursor: 'cursor-nesw-resize', size: 'w-5 h-5' },
  { id: 'bl', cls: '-bottom-2.5 -left-2.5',                  cursor: 'cursor-nesw-resize', size: 'w-5 h-5' },
  { id: 't',  cls: '-top-2.5 left-1/2 -translate-x-1/2',    cursor: 'cursor-n-resize',    size: 'w-4 h-4' },
  { id: 'b',  cls: '-bottom-2.5 left-1/2 -translate-x-1/2', cursor: 'cursor-s-resize',    size: 'w-4 h-4' },
  { id: 'l',  cls: '-left-2.5 top-1/2 -translate-y-1/2',    cursor: 'cursor-w-resize',    size: 'w-4 h-4' },
  { id: 'r',  cls: '-right-2.5 top-1/2 -translate-y-1/2',   cursor: 'cursor-e-resize',    size: 'w-4 h-4' },
]

export default function CompositionEditor({
  templateUrl, cutoutUrl,
  transform, onTransformChange,
  crop, onCropChange,
  playerName, nameBand,
  clubName, clubBand,
  uniformUrl, uniformTransform, onUniformTransformChange,
  uniformCrop, onUniformCropChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tplDims, setTplDims] = useState<{ w: number; h: number } | null>(null)
  const [cutDims, setCutDims] = useState<{ w: number; h: number } | null>(null)
  const [uniDims, setUniDims] = useState<{ w: number; h: number } | null>(null)

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

  useEffect(() => {
    if (!uniformUrl) { setUniDims(null); return }
    const img = new Image()
    img.onload = () => setUniDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = uniformUrl
  }, [uniformUrl])

  // ── Cutout handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const ox = transform.x, oy = transform.y
    function onMove(ev: PointerEvent) {
      onTransformChange({
        x: clamp(ox + (ev.clientX - sx) / rect.width, -0.5, 1.5),
        y: clamp(oy + (ev.clientY - sy) / rect.height, -0.5, 1.5),
        width: transform.width,
      })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [transform.x, transform.y, transform.width, onTransformChange])

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sw = transform.width
    function onMove(ev: PointerEvent) {
      onTransformChange({ x: transform.x, y: transform.y, width: clamp(sw + ((ev.clientX - sx) / rect.width) * 1.5, 0.1, 2) })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [transform, onTransformChange])

  const handleCropStart = useCallback((type: CropHandle, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container || !tplDims || !cutDims) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const sc = { ...crop }
    const hFrac = (transform.width * (tplDims.w / tplDims.h)) / (cutDims.w / cutDims.h)
    function onMove(ev: PointerEvent) {
      const dcx = ((ev.clientX - sx) / rect.width) / transform.width
      const dcy = ((ev.clientY - sy) / rect.height) / hFrac
      let { x, y, w, h } = sc
      const rx = x + w, by = y + h
      switch (type) {
        case 'tl': x=clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'tr': w=clamp(w+dcx,MIN_CROP,1-x);   y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'bl': x=clamp(x+dcx,0,rx-MIN_CROP);  w=rx-x; h=clamp(h+dcy,MIN_CROP,1-y); break
        case 't':  y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'b':  h=clamp(h+dcy,MIN_CROP,1-y); break
        case 'l':  x=clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; break
        case 'r':  w=clamp(w+dcx,MIN_CROP,1-x); break
      }
      onCropChange({ x, y, w, h })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [crop, transform, tplDims, cutDims, onCropChange])

  // ── Uniform handlers ─────────────────────────────────────────────────────────

  const handleUniformDragStart = useCallback((e: React.PointerEvent) => {
    if (!uniformTransform || !onUniformTransformChange) return
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const ox = uniformTransform.x, oy = uniformTransform.y
    function onMove(ev: PointerEvent) {
      onUniformTransformChange!({
        x: clamp(ox + (ev.clientX - sx) / rect.width, -0.5, 1.5),
        y: clamp(oy + (ev.clientY - sy) / rect.height, -0.5, 1.5),
        width: uniformTransform!.width,
      })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [uniformTransform, onUniformTransformChange])

  const handleUniformResizeStart = useCallback((e: React.PointerEvent) => {
    if (!uniformTransform || !onUniformTransformChange) return
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sw = uniformTransform.width
    function onMove(ev: PointerEvent) {
      onUniformTransformChange!({ x: uniformTransform!.x, y: uniformTransform!.y, width: clamp(sw + ((ev.clientX - sx) / rect.width) * 1.5, 0.1, 2) })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [uniformTransform, onUniformTransformChange])

  const handleUniformCropStart = useCallback((type: CropHandle, e: React.PointerEvent) => {
    if (!uniformTransform || !onUniformCropChange || !uniformCrop || !tplDims || !uniDims) return
    e.preventDefault(); e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const sc = { ...uniformCrop }
    const hFrac = (uniformTransform.width * (tplDims.w / tplDims.h)) / (uniDims.w / uniDims.h)
    function onMove(ev: PointerEvent) {
      const dcx = ((ev.clientX - sx) / rect.width) / uniformTransform!.width
      const dcy = ((ev.clientY - sy) / rect.height) / hFrac
      let { x, y, w, h } = sc
      const rx = x + w, by = y + h
      switch (type) {
        case 'tl': x=clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'tr': w=clamp(w+dcx,MIN_CROP,1-x);   y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'bl': x=clamp(x+dcx,0,rx-MIN_CROP);  w=rx-x; h=clamp(h+dcy,MIN_CROP,1-y); break
        case 't':  y=clamp(y+dcy,0,by-MIN_CROP); h=by-y; break
        case 'b':  h=clamp(h+dcy,MIN_CROP,1-y); break
        case 'l':  x=clamp(x+dcx,0,rx-MIN_CROP); w=rx-x; break
        case 'r':  w=clamp(w+dcx,MIN_CROP,1-x); break
      }
      onUniformCropChange!({ x, y, w, h })
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }, [uniformCrop, uniformTransform, tplDims, uniDims, onUniformCropChange])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!tplDims || !cutDims) {
    return <div className="aspect-[3/4] rounded-2xl bg-mundial-cream animate-pulse" />
  }

  const tplAspect = tplDims.w / tplDims.h
  const heightFraction = (transform.width * tplAspect) / (cutDims.w / cutDims.h)

  const uniHeightFraction = uniformTransform && uniDims
    ? (uniformTransform.width * tplAspect) / (uniDims.w / uniDims.h)
    : 0

  const showUniform = !!(uniformUrl && uniformTransform && uniDims && uniformCrop
    && onUniformTransformChange && onUniformCropChange)

  return (
    <div
      ref={containerRef}
      className="relative bg-mundial-cream rounded-2xl overflow-hidden select-none touch-none border-2 border-mundial-purple/10"
      style={{ aspectRatio: `${tplDims.w} / ${tplDims.h}`, containerType: 'inline-size' } as React.CSSProperties}
    >
      {/* Plantilla de fondo */}
      <img src={templateUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />

      {/* Cutout */}
      <div className="absolute" style={{ left: `${transform.x*100}%`, top: `${transform.y*100}%`, width: `${transform.width*100}%`, height: `${heightFraction*100}%` }}>
        <img src={cutoutUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none" draggable={false} />

        {/* Overlays oscuros fuera del crop */}
        <div className="absolute bg-black/50 pointer-events-none" style={{ left:0, top:0, right:0, height:`${crop.y*100}%` }} />
        <div className="absolute bg-black/50 pointer-events-none" style={{ left:0, top:`${(crop.y+crop.h)*100}%`, right:0, bottom:0 }} />
        <div className="absolute bg-black/50 pointer-events-none" style={{ left:0, top:`${crop.y*100}%`, width:`${crop.x*100}%`, height:`${crop.h*100}%` }} />
        <div className="absolute bg-black/50 pointer-events-none" style={{ left:`${(crop.x+crop.w)*100}%`, top:`${crop.y*100}%`, right:0, height:`${crop.h*100}%` }} />

        {/* Zona de arrastre */}
        <div className="absolute cursor-move touch-none" style={{ left:`${crop.x*100}%`, top:`${crop.y*100}%`, width:`${crop.w*100}%`, height:`${crop.h*100}%` }} onPointerDown={handleDragStart} />

        {/* Borde punteado — verde (cutout) */}
        <div className="absolute border-2 border-dashed border-mundial-green/80 pointer-events-none" style={{ left:`${crop.x*100}%`, top:`${crop.y*100}%`, width:`${crop.w*100}%`, height:`${crop.h*100}%` }} />

        {/* Handles de recorte — verde */}
        <div className="absolute pointer-events-none" style={{ left:`${crop.x*100}%`, top:`${crop.y*100}%`, width:`${crop.w*100}%`, height:`${crop.h*100}%` }}>
          {CROP_HANDLES.map(({ id, cls, cursor, size }) => (
            <div key={id} onPointerDown={(e) => handleCropStart(id, e)}
              className={`absolute pointer-events-auto ${size} bg-white border-2 border-mundial-green rounded-sm shadow-md z-10 touch-none ${cls} ${cursor}`} />
          ))}
        </div>

        {/* Resize — círculo amarillo */}
        <div role="button" aria-label="Redimensionar" onPointerDown={handleResizeStart}
          className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-mundial-yellow border-2 border-mundial-green rounded-full cursor-nwse-resize shadow-md z-10 touch-none hover:scale-110 transition-transform" />
      </div>

      {/* Uniforme — encima del cutout, handles en amarillo/naranja */}
      {showUniform && (
        <div className="absolute" style={{ left:`${uniformTransform!.x*100}%`, top:`${uniformTransform!.y*100}%`, width:`${uniformTransform!.width*100}%`, height:`${uniHeightFraction*100}%` }}>
          <img src={uniformUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none" draggable={false} crossOrigin="anonymous" />

          {/* Overlays oscuros fuera del crop del uniforme */}
          <div className="absolute bg-black/40 pointer-events-none" style={{ left:0, top:0, right:0, height:`${uniformCrop!.y*100}%` }} />
          <div className="absolute bg-black/40 pointer-events-none" style={{ left:0, top:`${(uniformCrop!.y+uniformCrop!.h)*100}%`, right:0, bottom:0 }} />
          <div className="absolute bg-black/40 pointer-events-none" style={{ left:0, top:`${uniformCrop!.y*100}%`, width:`${uniformCrop!.x*100}%`, height:`${uniformCrop!.h*100}%` }} />
          <div className="absolute bg-black/40 pointer-events-none" style={{ left:`${(uniformCrop!.x+uniformCrop!.w)*100}%`, top:`${uniformCrop!.y*100}%`, right:0, height:`${uniformCrop!.h*100}%` }} />

          {/* Zona de arrastre del uniforme */}
          <div className="absolute cursor-move touch-none" style={{ left:`${uniformCrop!.x*100}%`, top:`${uniformCrop!.y*100}%`, width:`${uniformCrop!.w*100}%`, height:`${uniformCrop!.h*100}%` }} onPointerDown={handleUniformDragStart} />

          {/* Borde punteado — amarillo (uniforme) */}
          <div className="absolute border-2 border-dashed border-mundial-yellow/90 pointer-events-none" style={{ left:`${uniformCrop!.x*100}%`, top:`${uniformCrop!.y*100}%`, width:`${uniformCrop!.w*100}%`, height:`${uniformCrop!.h*100}%` }} />

          {/* Handles de recorte — amarillo */}
          <div className="absolute pointer-events-none" style={{ left:`${uniformCrop!.x*100}%`, top:`${uniformCrop!.y*100}%`, width:`${uniformCrop!.w*100}%`, height:`${uniformCrop!.h*100}%` }}>
            {CROP_HANDLES.map(({ id, cls, cursor, size }) => (
              <div key={id} onPointerDown={(e) => handleUniformCropStart(id, e)}
                className={`absolute pointer-events-auto ${size} bg-white border-2 border-mundial-yellow rounded-sm shadow-md z-10 touch-none ${cls} ${cursor}`} />
            ))}
          </div>

          {/* Resize uniforme — círculo verde */}
          <div role="button" aria-label="Redimensionar uniforme" onPointerDown={handleUniformResizeStart}
            className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-mundial-green border-2 border-mundial-yellow rounded-full cursor-nwse-resize shadow-md z-10 touch-none hover:scale-110 transition-transform" />
        </div>
      )}

      {/* Preview nombre jugador */}
      {playerName && nameBand && (
        <div className="absolute pointer-events-none z-20"
          style={{ left:`${nameBand.x*100}%`, top:`${nameBand.y*100}%`, width:`${nameBand.width*100}%`, height:`${nameBand.height*100}%`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={bandTextStyle(nameBand)}>
            {(nameBand.uppercase ?? true) ? playerName.toUpperCase() : playerName}
          </span>
        </div>
      )}

      {/* Preview nombre club */}
      {clubName && clubBand && (
        <div className="absolute pointer-events-none z-20"
          style={{ left:`${clubBand.x*100}%`, top:`${clubBand.y*100}%`, width:`${clubBand.width*100}%`, height:`${clubBand.height*100}%`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={bandTextStyle(clubBand)}>
            {(clubBand.uppercase ?? true) ? clubName.toUpperCase() : clubName}
          </span>
        </div>
      )}
    </div>
  )
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function bandTextStyle(band: import('@/lib/supabase').NameBand): React.CSSProperties {
  return {
    fontFamily: 'Anton, Impact, sans-serif',
    fontSize: `${(band.font_size ?? 0.055) * 100}cqw`,
    color: band.color ?? '#FFFFFF',
    textTransform: (band.uppercase ?? true) ? 'uppercase' : 'none',
    fontWeight: 'bold',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    letterSpacing: '0.02em',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  }
}
