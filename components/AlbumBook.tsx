'use client'

import { useState, useCallback, useEffect } from 'react'
import type { AlbumSlot } from '@/lib/supabase'

interface Props {
  slots: AlbumSlot[]
  bySlot: Map<string, Array<{ image_url: string }>>
  portadaUrl: string | null
  contraportadaUrl: string | null
  albumName: string
  totalSlots: number
  collectedCount: number
}

type PageData =
  | { type: 'cover'; url: string }
  | { type: 'back'; url: string }
  | { type: 'slots'; items: AlbumSlot[] }
  | { type: 'blank' }

const SLOTS_PER_PAGE = 4

function buildPages(
  slots: AlbumSlot[],
  portadaUrl: string | null,
  contraportadaUrl: string | null,
): PageData[] {
  const pages: PageData[] = []
  pages.push(portadaUrl ? { type: 'cover', url: portadaUrl } : { type: 'blank' })
  for (let i = 0; i < slots.length; i += SLOTS_PER_PAGE) {
    pages.push({ type: 'slots', items: slots.slice(i, i + SLOTS_PER_PAGE) })
  }
  pages.push(contraportadaUrl ? { type: 'back', url: contraportadaUrl } : { type: 'blank' })
  // Pad to even count so spreads always have two pages
  if (pages.length % 2 !== 0) pages.push({ type: 'blank' })
  return pages
}

export default function AlbumBook({
  slots, bySlot, portadaUrl, contraportadaUrl, albumName, totalSlots, collectedCount,
}: Props) {
  const pages = buildPages(slots, portadaUrl, contraportadaUrl)
  const totalSpreads = pages.length / 2
  const [spread, setSpread] = useState(0)
  const [visible, setVisible] = useState(true)

  const go = useCallback((target: number) => {
    if (target < 0 || target >= totalSpreads) return
    setVisible(false)
    setTimeout(() => { setSpread(target); setVisible(true) }, 220)
  }, [totalSpreads])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(spread + 1)
      else if (e.key === 'ArrowLeft') go(spread - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, spread])

  const leftPage = pages[spread * 2]!
  const rightPage = pages[spread * 2 + 1] ?? { type: 'blank' as const }

  const pct = totalSlots > 0 ? Math.round((collectedCount / totalSlots) * 100) : 0

  return (
    <div className="space-y-5">
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

      {/* Book frame */}
      <div className="relative px-6 sm:px-8">
        {/* Drop shadow */}
        <div className="absolute inset-x-6 sm:inset-x-8 -bottom-2 h-4 bg-black/15 blur-lg rounded-full" />

        {/* Pages */}
        <div
          className="flex rounded-xl sm:rounded-2xl overflow-hidden border border-mundial-purple/10 shadow-2xl"
          style={{
            opacity:    visible ? 1 : 0,
            transform:  visible ? 'scale(1)' : 'scale(0.975)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          {/* Left page */}
          <div className="flex-1 min-h-[320px] sm:min-h-[380px]">
            <PageContent page={leftPage} bySlot={bySlot} albumName={albumName} />
          </div>

          {/* Spine */}
          <div className="w-[5px] shrink-0 bg-gradient-to-r from-mundial-purple/20 via-mundial-purple/8 to-transparent shadow-[inset_-2px_0_3px_rgba(0,0,0,0.06)]" />

          {/* Right page — visible only sm+ */}
          <div className="hidden sm:flex flex-1 min-h-[380px]">
            <PageContent page={rightPage} bySlot={bySlot} albumName={albumName} isRight />
          </div>
        </div>

        {/* Prev arrow */}
        <button
          onClick={() => go(spread - 1)}
          disabled={spread === 0}
          aria-label="Página anterior"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-mundial-purple/15 shadow-md flex items-center justify-center text-mundial-purple/50 hover:text-mundial-purple hover:shadow-lg disabled:opacity-20 disabled:cursor-default transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Next arrow */}
        <button
          onClick={() => go(spread + 1)}
          disabled={spread === totalSpreads - 1}
          aria-label="Página siguiente"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-mundial-purple/15 shadow-md flex items-center justify-center text-mundial-purple/50 hover:text-mundial-purple hover:shadow-lg disabled:opacity-20 disabled:cursor-default transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Páginas del álbum">
        {Array.from({ length: totalSpreads }, (_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === spread}
            aria-label={`Ir a spread ${i + 1}`}
            onClick={() => go(i)}
            className={[
              'rounded-full transition-all duration-200',
              i === spread
                ? 'w-5 h-2 bg-mundial-purple'
                : 'w-2 h-2 bg-mundial-purple/20 hover:bg-mundial-purple/40',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Page label */}
      <p className="text-center text-[10px] text-mundial-purple/35 font-condensed tracking-[0.2em] uppercase">
        {spread === 0 ? 'Portada' : spread === totalSpreads - 1 ? 'Contraportada' : `Páginas ${spread * 2}–${Math.min(spread * 2 + 1, pages.length - 2)} de ${pages.length - 2}`}
      </p>
    </div>
  )
}

/* ─── Individual page content ─────────────────────────────── */

function PageContent({
  page, bySlot, albumName, isRight = false,
}: {
  page: PageData
  bySlot: Map<string, { image_url: string }[]>
  albumName: string
  isRight?: boolean
}) {
  if (page.type === 'blank') {
    return <div className="w-full h-full min-h-[320px] sm:min-h-[380px] bg-[#fdf8f0]" />
  }

  if (page.type === 'cover') {
    return (
      <div className="relative w-full min-h-[320px] sm:min-h-[380px] bg-mundial-navy-deep overflow-hidden">
        <img
          src={page.url}
          alt={albumName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 pt-10">
          <p className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-mundial-yellow/70 mb-0.5">
            Álbum Digital
          </p>
          <p className="font-display text-base tracking-wide uppercase text-white leading-tight line-clamp-2">
            {albumName}
          </p>
        </div>
      </div>
    )
  }

  if (page.type === 'back') {
    return (
      <div className="relative w-full min-h-[320px] sm:min-h-[380px] overflow-hidden">
        <img
          src={page.url}
          alt="Contraportada"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm">
          <span className="font-condensed text-[8px] font-bold tracking-[0.25em] uppercase text-white/70">
            Contraportada
          </span>
        </div>
      </div>
    )
  }

  // Slots page
  const firstNum = page.items[0]?.slot_number
  const lastNum  = page.items[page.items.length - 1]?.slot_number

  return (
    <div className="w-full min-h-[320px] sm:min-h-[380px] bg-[#fdf8f0] flex flex-col p-3 gap-1.5">
      {/* Slot grid: 2 columns */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {page.items.map((slot) => {
          const sticker = bySlot.get(slot.id)?.[0]
          return (
            <div
              key={slot.id}
              className={[
                'relative rounded-lg overflow-hidden border-2 aspect-[3/4] bg-white/60',
                sticker
                  ? 'border-mundial-green/30 shadow-sm'
                  : 'border-dashed border-mundial-purple/15',
              ].join(' ')}
            >
              {sticker ? (
                <>
                  <img
                    src={sticker.image_url}
                    alt={`Cromo #${slot.slot_number}`}
                    className="w-full h-full object-contain"
                  />
                  {/* Collected badge */}
                  <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-mundial-green shadow-sm border border-white/60" />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
                  {/* Sticker guide lines — like a real album */}
                  <div className="w-full h-full absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(0deg, #3D2761, #3D2761 1px, transparent 1px, transparent 8px), repeating-linear-gradient(90deg, #3D2761, #3D2761 1px, transparent 1px, transparent 8px)',
                    }}
                  />
                  <span className="font-display text-lg sm:text-2xl text-mundial-purple/20 font-bold relative">
                    {slot.slot_number}
                  </span>
                  {slot.label ? (
                    <span className="text-[7px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/18 text-center line-clamp-1 relative px-1">
                      {slot.label}
                    </span>
                  ) : (
                    <span className="text-[7px] font-condensed tracking-wider uppercase text-mundial-purple/15 relative">
                      pegar aquí
                    </span>
                  )}
                </div>
              )}
              {/* Footer label */}
              <div className="absolute bottom-0 inset-x-0 bg-white/75 backdrop-blur-[1px] px-1 py-[2px]">
                <p className="font-display text-[7px] tracking-wide uppercase text-mundial-purple/40 text-center truncate">
                  #{slot.slot_number}{slot.label ? ` · ${slot.label}` : ''}
                </p>
              </div>
            </div>
          )
        })}

        {/* Empty cells to keep 2×2 grid */}
        {Array.from({ length: SLOTS_PER_PAGE - page.items.length }, (_, i) => (
          <div key={`pad-${i}`} className="aspect-[3/4]" />
        ))}
      </div>

      {/* Page number */}
      <p className={[
        'text-[8px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-purple/20 pt-0.5',
        isRight ? 'text-right' : 'text-left',
      ].join(' ')}>
        {firstNum != null && lastNum != null ? `#${firstNum}–#${lastNum}` : ''}
      </p>
    </div>
  )
}
