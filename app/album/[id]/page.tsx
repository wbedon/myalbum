'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'

// ── Types returned by get_public_album RPC ──────────────────────────
interface PublicSlot {
  id: string
  slot_number: number
  label: string | null
}

interface PublicSticker {
  id: string
  image_url: string
  slot_id: string
  user_id: string
  username: string
}

interface PublicReaction {
  sticker_id: string
  emoji: string
  count: number
}

interface PublicRankEntry {
  user_id: string
  username: string
  slots_count: number
}

interface PublicAlbumData {
  album: { id: string; name: string; description: string | null }
  slots: PublicSlot[]
  stickers: PublicSticker[]
  reactions: PublicReaction[]
  ranking: PublicRankEntry[]
}

export default function PublicAlbumPage() {
  const params = useParams()
  const albumId = params?.id as string

  const [data, setData]     = useState<PublicAlbumData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    if (!albumId) return
    supabase
      .rpc('get_public_album', { p_album_id: albumId })
      .then(({ data: raw, error }) => {
        if (error || !raw) { setStatus('notfound'); return }
        setData(raw as PublicAlbumData)
        setStatus('ready')
      })
  }, [albumId])

  if (status === 'loading') {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-mundial-purple/20 border-t-mundial-purple rounded-full animate-spin" />
        </div>
      </PageShell>
    )
  }

  if (status === 'notfound' || !data) {
    return (
      <PageShell>
        <div className="max-w-sm mx-auto text-center py-20 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-red/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-mundial-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="font-display text-xl tracking-wide uppercase text-mundial-purple">Álbum no encontrado</h2>
          <p className="text-sm text-mundial-purple/60">Este álbum no existe o no es público.</p>
          <Link href="/" className="inline-flex px-6 py-3 bg-mundial-purple text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors">
            Ir al inicio
          </Link>
        </div>
      </PageShell>
    )
  }

  const { album, slots, stickers, reactions, ranking } = data

  // Build lookup maps
  const bySlot = new Map<string, PublicSticker[]>()
  stickers.forEach((s) => {
    if (!bySlot.has(s.slot_id)) bySlot.set(s.slot_id, [])
    bySlot.get(s.slot_id)!.push(s)
  })

  // reactions: sticker_id → emoji → count
  const rxMap = new Map<string, Map<string, number>>()
  reactions.forEach((r) => {
    if (!rxMap.has(r.sticker_id)) rxMap.set(r.sticker_id, new Map())
    rxMap.get(r.sticker_id)!.set(r.emoji, r.count)
  })

  const totalSlots    = slots.length
  const coveredSlots  = slots.filter((sl) => bySlot.has(sl.id)).length
  const totalApproved = stickers.length

  return (
    <PageShell album={album}>
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-10">

        {/* ── Banners ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 pt-6">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-mundial-yellow/15 border border-mundial-yellow/40 rounded-2xl">
            <svg className="w-4 h-4 text-mundial-yellow-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {totalApproved} sticker{totalApproved !== 1 ? 's' : ''} aprobado{totalApproved !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 bg-mundial-green/10 border border-mundial-green/30 rounded-2xl">
            <svg className="w-4 h-4 text-mundial-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {coveredSlots}/{totalSlots} slot{totalSlots !== 1 ? 's' : ''} con sticker
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 bg-mundial-purple/8 border border-mundial-purple/20 rounded-2xl">
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {ranking.length} participante{ranking.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Galería por slot ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Galería
          </h2>

          {slots.length === 0 ? (
            <p className="text-sm text-mundial-purple/40 italic">Sin slots en este álbum.</p>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => {
                const items = bySlot.get(slot.id) ?? []
                return (
                  <div key={slot.id} className={[
                    'rounded-2xl overflow-hidden border',
                    items.length > 0
                      ? 'border-mundial-purple/10 bg-white/70'
                      : 'border-dashed border-mundial-purple/15 bg-mundial-cream/40',
                  ].join(' ')}>
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-mundial-purple/8">
                      <div className="w-8 h-8 rounded-lg bg-mundial-purple/10 flex items-center justify-center shrink-0">
                        <span className="font-display text-sm text-mundial-purple font-bold">{slot.slot_number}</span>
                      </div>
                      <span className="font-display text-sm tracking-wider uppercase text-mundial-purple">
                        {slot.label ?? <span className="text-mundial-purple/40 italic">Sin etiqueta</span>}
                      </span>
                      <span className="ml-auto font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40">
                        {items.length} versión{items.length !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <p className="text-xs text-mundial-purple/30 font-condensed font-bold tracking-wider uppercase">
                          Sin stickers aprobados
                        </p>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex gap-4 flex-wrap">
                          {items.map((s) => {
                            const sxRx = rxMap.get(s.id)
                            return (
                              <div key={s.id} className="flex flex-col items-center gap-1.5">
                                <div className="w-20 h-[100px] rounded-xl overflow-hidden border-2 border-mundial-purple/10">
                                  <img
                                    src={s.image_url}
                                    alt={`${s.username} · slot ${slot.slot_number}`}
                                    className="w-full h-full object-contain bg-mundial-cream"
                                  />
                                </div>
                                <span className="text-[10px] font-condensed font-bold tracking-wider uppercase max-w-[80px] truncate text-center text-mundial-purple/50">
                                  {s.username}
                                </span>
                                {/* Reaction counts (read-only) */}
                                {sxRx && sxRx.size > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    {['❤️', '🔥', '⭐', '😂'].map((emoji) => {
                                      const cnt = sxRx.get(emoji) ?? 0
                                      if (!cnt) return null
                                      return (
                                        <span key={emoji} className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] bg-mundial-purple/8 text-mundial-purple/60 leading-none">
                                          <span className="text-[11px]">{emoji}</span>
                                          <span className="font-condensed font-bold text-[9px]">{cnt}</span>
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Ranking ───────────────────────────────────────────────── */}
        {ranking.length > 0 && totalSlots > 0 && (
          <section className="space-y-3">
            <h2 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
              Ranking · {ranking.length} participante{ranking.length !== 1 ? 's' : ''}
            </h2>
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-mundial-purple/8">
              {ranking.map((m, idx) => {
                const pct = totalSlots > 0 ? (m.slots_count / totalSlots) * 100 : 0
                return (
                  <div key={m.user_id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-7 text-center shrink-0">
                      {idx === 0 && m.slots_count > 0 ? (
                        <span className="text-base">🥇</span>
                      ) : idx === 1 && m.slots_count > 0 ? (
                        <span className="text-base">🥈</span>
                      ) : idx === 2 && m.slots_count > 0 ? (
                        <span className="text-base">🥉</span>
                      ) : (
                        <span className="font-condensed text-xs font-bold text-mundial-purple/40">#{idx + 1}</span>
                      )}
                    </div>
                    <Avatar username={m.username} size="sm" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="font-display text-sm tracking-wider uppercase truncate text-mundial-purple block">
                        {m.username}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-mundial-purple/10 overflow-hidden">
                          <div
                            className={['h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-mundial-green' : 'bg-mundial-purple/40'].join(' ')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-condensed text-[10px] font-bold text-mundial-purple/50 shrink-0 tabular-nums">
                          {m.slots_count}/{totalSlots}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <p className="font-condensed text-xs font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            ¿Querés participar?
          </p>
          <p className="text-sm text-mundial-purple/60">
            Pedí una invitación al organizador para crear tus stickers del Mundial.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-mundial-purple text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Crear mi propio sticker
          </Link>
        </div>
      </div>
    </PageShell>
  )
}

// ── Shell ────────────────────────────────────────────────────────────

function PageShell({
  album,
  children,
}: {
  album?: { name: string; description: string | null }
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col">
      {/* Top bar */}
      <div className="bg-mundial-navy-deep text-white px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple">
            <span className="font-display text-lg leading-none">M</span>
          </div>
          <span className="font-display text-base tracking-widest">MYALBUM</span>
        </Link>
        <Link
          href="/"
          className="text-xs font-condensed font-bold tracking-wider uppercase text-mundial-yellow/70 hover:text-mundial-yellow transition-colors"
        >
          Iniciar sesión →
        </Link>
      </div>

      {/* Album header */}
      {album && (
        <div className="bg-mundial-navy-deep/95 text-white px-4 pt-8 pb-6">
          <div className="max-w-4xl mx-auto">
            <p className="font-condensed text-[10px] font-bold tracking-[0.4em] uppercase text-mundial-yellow/60 mb-2">
              Álbum público
            </p>
            <h1 className="font-display text-3xl tracking-wide uppercase text-white">
              {album.name}
            </h1>
            {album.description && (
              <p className="mt-1 text-sm text-white/60">{album.description}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="bg-mundial-navy-deep text-white/40 text-center py-4">
        <p className="font-condensed text-[10px] tracking-widest uppercase">
          MYALBUM · MUNDIAL 2026 EDITION
        </p>
      </footer>
    </div>
  )
}
