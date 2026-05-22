'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type CropBox = { x: number; y: number; w: number; h: number }
type Handle = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'

interface Props {
  imageUrl: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const MIN = 0.04

export default function CropEditor({ imageUrl, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cropRef = useRef<CropBox>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const [crop, setCropState] = useState<CropBox>(cropRef.current)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)
  const [applying, setApplying] = useState(false)

  // Sincroniza ref con state para que los event listeners lean siempre el valor más fresco
  const setCrop = useCallback((c: CropBox) => {
    cropRef.current = c
    setCropState(c)
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageUrl
  }, [imageUrl])

  const handleConfirm = useCallback(async () => {
    if (!imgDims) return
    setApplying(true)
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = imageUrl
      })
      const c = cropRef.current
      const cx = Math.round(c.x * imgDims.w)
      const cy = Math.round(c.y * imgDims.h)
      const cw = Math.max(1, Math.round(c.w * imgDims.w))
      const ch = Math.max(1, Math.round(c.h * imgDims.h))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D no disponible')
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch)
      canvas.toBlob(blob => {
        if (blob) onConfirm(blob)
        setApplying(false)
      }, 'image/png')
    } catch {
      setApplying(false)
    }
  }, [imgDims, imageUrl, onConfirm])

  // Fabrica el handler de pointer para cada tipo de handle
  function makeHandler(type: Handle) {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const sx = e.clientX
      const sy = e.clientY
      const start = { ...cropRef.current }

      function onMove(ev: PointerEvent) {
        const dx = (ev.clientX - sx) / rect.width
        const dy = (ev.clientY - sy) / rect.height
        let { x, y, w, h } = start
        const rx = start.x + start.w  // right edge (fijo en resizes izquierdos)
        const by = start.y + start.h  // bottom edge (fijo en resizes superiores)

        switch (type) {
          case 'move':
            x = clamp(x + dx, 0, 1 - w)
            y = clamp(y + dy, 0, 1 - h)
            break
          case 'tl':
            x = clamp(x + dx, 0, rx - MIN); w = rx - x
            y = clamp(y + dy, 0, by - MIN); h = by - y
            break
          case 'tr':
            w = clamp(w + dx, MIN, 1 - x)
            y = clamp(y + dy, 0, by - MIN); h = by - y
            break
          case 'bl':
            x = clamp(x + dx, 0, rx - MIN); w = rx - x
            h = clamp(h + dy, MIN, 1 - y)
            break
          case 'br':
            w = clamp(w + dx, MIN, 1 - x)
            h = clamp(h + dy, MIN, 1 - y)
            break
          case 't':
            y = clamp(y + dy, 0, by - MIN); h = by - y
            break
          case 'b':
            h = clamp(h + dy, MIN, 1 - y)
            break
          case 'l':
            x = clamp(x + dx, 0, rx - MIN); w = rx - x
            break
          case 'r':
            w = clamp(w + dx, MIN, 1 - x)
            break
        }
        setCrop({ x, y, w, h })
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  const aspect = imgDims ? imgDims.w / imgDims.h : 3 / 4

  const corners: { id: Handle; cls: string }[] = [
    { id: 'tl', cls: '-top-2.5 -left-2.5 cursor-nwse-resize' },
    { id: 'tr', cls: '-top-2.5 -right-2.5 cursor-nesw-resize' },
    { id: 'bl', cls: '-bottom-2.5 -left-2.5 cursor-nesw-resize' },
    { id: 'br', cls: '-bottom-2.5 -right-2.5 cursor-nwse-resize' },
  ]
  const edges: { id: Handle; cls: string }[] = [
    { id: 't', cls: '-top-2.5 left-1/2 -translate-x-1/2 cursor-n-resize' },
    { id: 'b', cls: '-bottom-2.5 left-1/2 -translate-x-1/2 cursor-s-resize' },
    { id: 'l', cls: '-left-2.5 top-1/2 -translate-y-1/2 cursor-w-resize' },
    { id: 'r', cls: '-right-2.5 top-1/2 -translate-y-1/2 cursor-e-resize' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-mundial-purple/10 shrink-0">
          <p className="font-display text-base uppercase tracking-wider text-mundial-purple">
            Recortá tu foto
          </p>
          <p className="text-xs text-mundial-purple/60 mt-0.5">
            Arrastrá el recuadro para moverlo · esquinas y bordes para ajustar
          </p>
        </div>

        {/* Canvas de recorte */}
        <div className="p-4 flex-1 flex items-center justify-center overflow-hidden">
          <div
            ref={containerRef}
            className="relative select-none touch-none bg-checkerboard rounded-xl overflow-hidden w-full"
            style={{ aspectRatio: String(aspect), maxHeight: '58vh' }}
          >
            {/* Imagen */}
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />

            {/* Overlay oscuro en 4 franjas alrededor del recuadro */}
            <div className="absolute inset-x-0 top-0 bg-black/55 pointer-events-none"
              style={{ height: `${crop.y * 100}%` }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/55 pointer-events-none"
              style={{ height: `${(1 - crop.y - crop.h) * 100}%` }} />
            <div className="absolute left-0 bg-black/55 pointer-events-none"
              style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${crop.x * 100}%` }} />
            <div className="absolute right-0 bg-black/55 pointer-events-none"
              style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%` }} />

            {/* Recuadro de recorte */}
            <div
              className="absolute border-2 border-white/90 cursor-move"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              onPointerDown={makeHandler('move')}
            >
              {/* Grilla de tercios */}
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),' +
                    'linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
                  backgroundSize: '33.33% 33.33%',
                }}
              />

              {/* Handles de esquina */}
              {corners.map(({ id, cls }) => (
                <div
                  key={id}
                  onPointerDown={makeHandler(id)}
                  className={`absolute w-5 h-5 bg-white border-2 border-mundial-green rounded-sm shadow-md z-10 ${cls}`}
                />
              ))}

              {/* Handles de borde */}
              {edges.map(({ id, cls }) => (
                <div
                  key={id}
                  onPointerDown={makeHandler(id)}
                  className={`absolute w-4 h-4 bg-white border-2 border-mundial-green rounded-sm shadow-md z-10 ${cls}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-mundial-purple/10 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-mundial-purple/60 hover:text-mundial-purple font-display text-sm uppercase tracking-wider rounded-xl hover:bg-mundial-purple/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={applying || !imgDims}
            className="flex-1 py-3 bg-gradient-to-r from-mundial-green to-mundial-turquoise text-white font-display text-sm uppercase tracking-wider rounded-xl shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {applying ? 'Aplicando…' : 'Confirmar recorte'}
          </button>
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
