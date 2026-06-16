'use client'

import { forwardRef, useRef, useState, useCallback, type ReactNode } from 'react'
import HTMLFlipBook from 'react-pageflip'
import type { AlbumSlot } from '@/lib/supabase'

const SLOTS_PER_PAGE = 4

/* ─── Cover page (hard) ────────────────────────────────────── */
const CoverPage = forwardRef<
  HTMLDivElement,
  { url: string | null; name: string; total: number; collected: number }
>(function CoverPage({ url, name, total, collected }, ref) {
  return (
    <div ref={ref} data-density="hard" className="relative h-full overflow-hidden select-none">
      {url ? (
        <>
          <img src={url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-mundial-purple to-mundial-navy-deep" />
      )}
      <div className="relative h-full flex flex-col items-center justify-center p-6">
        <div className="absolute inset-4 rounded border border-white/25" />
        <p className="font-condensed text-[10px] font-bold tracking-[0.4em] uppercase text-mundial-yellow/80 mb-2">
          Álbum Digital
        </p>
        <h2 className="font-display text-2xl tracking-wide uppercase text-white leading-tight text-center drop-shadow-lg">
          {name}
        </h2>
        <div className="mt-6 px-4 py-1.5 rounded-full border border-white/40 bg-black/30 backdrop-blur-sm text-sm text-white/90 font-condensed font-bold">
          {collected} / {total} stickers
        </div>
        <p className="absolute bottom-5 font-condensed text-[9px] tracking-[0.3em] uppercase text-white/35">
          myalbum · mundial 2026
        </p>
      </div>
    </div>
  )
})

/* ─── Back cover page (hard) ───────────────────────────────── */
const BackPage = forwardRef<
  HTMLDivElement,
  { url: string | null; total: number; collected: number }
>(function BackPage({ url, total, collected }, ref) {
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0
  return (
    <div ref={ref} data-density="hard" className="relative h-full overflow-hidden select-none">
      {url ? (
        <>
          <img src={url} alt="Contraportada" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-mundial-navy-deep to-mundial-purple/80" />
      )}
      <div className="relative h-full flex flex-col items-center justify-center p-6 gap-4">
        <p className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-white/60">
          Mi Progreso
        </p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-[200px]">
          <StatBox label="Pegados"     value={`${collected}/${total}`} />
          <StatBox label="Completado"  value={`${pct}%`} />
        </div>
        <div className="w-full max-w-[180px] h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-mundial-yellow rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-center text-[10px] italic text-white/35 max-w-[180px] leading-relaxed">
          "Cada sticker cuenta una historia. ¡Sigue coleccionando!"
        </p>
      </div>
    </div>
  )
})

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-3 text-center">
      <p className="font-display text-xl text-white">{value}</p>
      <p className="font-condensed text-[8px] uppercase tracking-wider text-white/50 mt-0.5">{label}</p>
    </div>
  )
}

/* ─── Inner slot page (soft) ───────────────────────────────── */
const FlipPage = forwardRef<
  HTMLDivElement,
  {
    slots: AlbumSlot[]
    bySlot: Map<string, Array<{ image_url: string }>>
  }
>(function FlipPage({ slots, bySlot }, ref) {
  const firstNum = slots[0]?.slot_number
  const lastNum  = slots[slots.length - 1]?.slot_number
  return (
    <div
      ref={ref}
      data-density="soft"
      className="h-full overflow-hidden bg-[#fdf8f0] flex flex-col p-3 gap-2 select-none"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg,rgba(0,0,0,0.018),rgba(0,0,0,0.018) 1px,transparent 1px,transparent 24px)',
        boxShadow: 'inset 0 0 14px rgba(61,39,97,0.12)',
      }}
    >
      <div className="flex-1 grid grid-cols-2 gap-2">
        {slots.map((slot) => {
          const sticker = bySlot.get(slot.id)?.[0]
          return (
            <div
              key={slot.id}
              className={[
                'relative rounded-xl overflow-hidden border-2 aspect-[3/4] bg-white/60',
                sticker
                  ? 'border-mundial-green/30 shadow-sm'
                  : 'border-dashed border-mundial-purple/15',
              ].join(' ')}
            >
              {sticker ? (
                <>
                  <img
                    src={sticker.image_url}
                    alt={`#${slot.slot_number}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-mundial-green shadow-sm border border-white/60" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg,#3D2761,#3D2761 1px,transparent 1px,transparent 8px),' +
                        'repeating-linear-gradient(90deg,#3D2761,#3D2761 1px,transparent 1px,transparent 8px)',
                    }}
                  />
                  <span className="font-display text-xl text-mundial-purple/20 font-bold relative">
                    {slot.slot_number}
                  </span>
                  <span className="text-[7px] font-condensed tracking-wider uppercase text-mundial-purple/15 relative">
                    pegar aquí
                  </span>
                </div>
              )}
              {/* Footer label */}
              <div className="absolute bottom-0 inset-x-0 bg-white/80 px-1 py-[2px]">
                <p className="font-display text-[7px] tracking-wide uppercase text-mundial-purple/40 text-center truncate">
                  #{slot.slot_number}{slot.label ? ` · ${slot.label}` : ''}
                </p>
              </div>
            </div>
          )
        })}
        {/* Padding cells */}
        {Array.from({ length: SLOTS_PER_PAGE - slots.length }, (_, i) => (
          <div
            key={`pad-${i}`}
            className="aspect-[3/4] rounded-xl border-2 border-dashed border-mundial-purple/8 bg-white/30"
          />
        ))}
      </div>
      {/* Page range */}
      <p className="text-[8px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-purple/20 pt-0.5 text-center">
        {firstNum != null && lastNum != null ? `#${firstNum} – #${lastNum}` : ''}
      </p>
    </div>
  )
})

/* ─── Blank page (padding) ─────────────────────────────────── */
const BlankPage = forwardRef<HTMLDivElement>(function BlankPage(_, ref) {
  return (
    <div
      ref={ref}
      data-density="soft"
      className="h-full bg-[#fdf8f0]"
      style={{ boxShadow: 'inset 0 0 14px rgba(61,39,97,0.12)' }}
    />
  )
})

/* ─── Build pages array (no conditional children) ─────────── */
function buildBookPages({
  portadaUrl, albumName, totalSlots, collectedCount,
  slotChunks, bySlot, needsPadding, contraportadaUrl,
}: {
  portadaUrl: string | null
  albumName: string
  totalSlots: number
  collectedCount: number
  slotChunks: AlbumSlot[][]
  bySlot: Map<string, Array<{ image_url: string }>>
  needsPadding: boolean
  contraportadaUrl: string | null
}): ReactNode[] {
  const pages: ReactNode[] = []
  pages.push(
    <CoverPage key="cover" url={portadaUrl} name={albumName} total={totalSlots} collected={collectedCount} />,
  )
  slotChunks.forEach((chunk, i) => {
    pages.push(<FlipPage key={`slot-${i}`} slots={chunk} bySlot={bySlot} />)
  })
  if (needsPadding) {
    pages.push(<BlankPage key="blank-pad" />)
  }
  pages.push(
    <BackPage key="back" url={contraportadaUrl} total={totalSlots} collected={collectedCount} />,
  )
  return pages
}

/* ─── Main component ────────────────────────────────────────── */
interface Props {
  slots: AlbumSlot[]
  bySlot: Map<string, Array<{ image_url: string }>>
  portadaUrl: string | null
  contraportadaUrl: string | null
  albumName: string
  totalSlots: number
  collectedCount: number
}

export default function AlbumBookInner({
  slots, bySlot, portadaUrl, contraportadaUrl, albumName, totalSlots, collectedCount,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef   = useRef<any>(null)
  const scrollRef = useRef(0)
  const [currentPage, setCurrentPage] = useState(0)

  // Preserve scroll — react-pageflip mutates the DOM across several frames,
  // which resets scroll on iOS. Double-rAF waits for the full paint cycle.
  const restoreScroll = useCallback(() => {
    const y = scrollRef.current
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
      })
    })
  }, [])

  const goNext = useCallback(() => {
    scrollRef.current = window.scrollY
    bookRef.current?.pageFlip().flipNext()
    restoreScroll()
  }, [restoreScroll])

  const goPrev = useCallback(() => {
    scrollRef.current = window.scrollY
    bookRef.current?.pageFlip().flipPrev()
    restoreScroll()
  }, [restoreScroll])

  // Build pages array imperatively — react-pageflip uses React.Children.map + cloneElement
  // internally, which throws if any child is null/false/undefined. Never use && or ternaries
  // directly as JSX children of HTMLFlipBook; build a clean array instead (mirrors AlbumEscolar).
  const slotChunks: AlbumSlot[][] = []
  for (let i = 0; i < slots.length; i += SLOTS_PER_PAGE)
    slotChunks.push(slots.slice(i, i + SLOTS_PER_PAGE))

  const needsPadding = slotChunks.length % 2 !== 0
  const totalPages = 1 + slotChunks.length + (needsPadding ? 1 : 0) + 1

  const bookPages = buildBookPages({
    portadaUrl, albumName, totalSlots, collectedCount,
    slotChunks, bySlot, needsPadding, contraportadaUrl,
  })

  const pct = totalSlots > 0 ? Math.round((collectedCount / totalSlots) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-mundial-purple/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-mundial-green to-mundial-turquoise rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-condensed font-bold text-mundial-purple/50 tabular-nums whitespace-nowrap">
          {collectedCount}/{totalSlots} ({pct}%)
        </span>
      </div>

      {/* Book stage — overflow-anchor:none prevents browser scroll-anchor reflow */}
      <div className="relative rounded-2xl bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900 p-4 sm:p-6 shadow-2xl" style={{ overflowAnchor: 'none' }}>
        {/* Subtle grain texture */}
        <div
          className="absolute inset-0 rounded-2xl opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='1' height='1' x='1' y='1' fill='%23ffffff'/%3E%3C/svg%3E\")",
          }}
        />

        {/* HTMLFlipBook — touch-action:none prevents page scroll while dragging pages */}
        <div className="flex justify-center" style={{ touchAction: 'none' }}>
          {/* @ts-ignore – react-pageflip ref typing is loose */}
          <HTMLFlipBook
            ref={bookRef}
            width={300}
            height={440}
            size="stretch"
            minWidth={200}
            maxWidth={400}
            minHeight={300}
            maxHeight={580}
            showCover={true}
            showPageCorners={false}
            useMouseEvents={true}
            mobileScrollSupport={false}
            swipeDistance={40}
            flippingTime={400}
            maxShadowOpacity={0.3}
            drawShadow={true}
            clickEventForward={false}
            disableFlipByClick={false}
            usePortrait={true}
            autoSize={true}
            startPage={0}
            startZIndex={0}
            renderOnlyPageLengthChange={true}
            className=""
            style={{}}
            onFlip={(e: { data: number }) => setCurrentPage(e.data)}
          >
            {bookPages}
          </HTMLFlipBook>
        </div>

        {/* Navigation controls */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={goPrev}
            onMouseDown={e => e.preventDefault()}
            disabled={currentPage === 0}
            className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-default px-5 py-2 text-sm font-condensed font-bold tracking-wider text-stone-100 transition-colors"
          >
            ‹ Anterior
          </button>
          <span className="text-xs font-condensed text-white/40 tabular-nums min-w-[70px] text-center">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            onMouseDown={e => e.preventDefault()}
            disabled={currentPage >= totalPages - 1}
            className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:cursor-default px-5 py-2 text-sm font-condensed font-bold tracking-wider text-stone-100 transition-colors"
          >
            Siguiente ›
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-stone-500 font-condensed tracking-wider">
          Desliza o usa los botones para pasar página
        </p>
      </div>
    </div>
  )
}
