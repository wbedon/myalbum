'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album, type AlbumSlot, type AlbumMember } from '@/lib/supabase'
import Avatar from './Avatar'
import UserProfileModal from './UserProfileModal'

interface ApprovedSticker {
  id: string
  image_url: string
  slot_id: string
  user_id: string
  username: string
}

interface Props {
  album: Album
  currentUserId: string
  slots: AlbumSlot[]
  members: AlbumMember[]
}

export default function GalleryView({ album, currentUserId, slots, members }: Props) {
  const [loading, setLoading]               = useState(true)
  const [stickers, setStickers]             = useState<ApprovedSticker[]>([])
  const [userSlots, setUserSlots]           = useState<Map<string, Set<string>>>(new Map())
  const [profileUserId, setProfileUserId]   = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // All approved stickers for this album
    const { data: stickersRaw } = await supabase
      .from('stickers')
      .select('id, image_url, slot_id, user_id')
      .eq('album_id', album.id)
      .eq('status', 'approved')

    // Profiles for creators
    const creatorIds = Array.from(new Set((stickersRaw ?? []).map((s: { user_id: string }) => s.user_id)))
    const { data: profilesRaw } = creatorIds.length > 0
      ? await supabase.from('profiles').select('user_id, username').in('user_id', creatorIds)
      : { data: [] }
    const profileMap = new Map(
      (profilesRaw ?? []).map((p: { user_id: string; username: string | null }) => [p.user_id, p.username])
    )

    const parsed: ApprovedSticker[] = (stickersRaw ?? []).map(
      (s: { id: string; image_url: string; slot_id: string; user_id: string }) => ({
        id:         s.id,
        image_url:  s.image_url,
        slot_id:    s.slot_id,
        user_id:    s.user_id,
        username:   (profileMap.get(s.user_id) ?? s.user_id.slice(0, 8)) as string,
      })
    )

    // Collection items for leaderboard — group by user, count unique slots
    const { data: collRaw } = await supabase
      .from('collection')
      .select('user_id, sticker_id')
      .eq('album_id', album.id)

    const stickerToSlot = new Map(parsed.map((s) => [s.id, s.slot_id]))
    const us = new Map<string, Set<string>>()
    ;(collRaw ?? []).forEach((c: { user_id: string; sticker_id: string }) => {
      const slotId = stickerToSlot.get(c.sticker_id)
      if (!slotId) return
      if (!us.has(c.user_id)) us.set(c.user_id, new Set())
      us.get(c.user_id)!.add(slotId)
    })

    setStickers(parsed)
    setUserSlots(us)
    setLoading(false)
  }, [album.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived ──────────────────────────────────────────────────────
  const bySlot = new Map<string, ApprovedSticker[]>()
  stickers.forEach((s) => {
    if (!bySlot.has(s.slot_id)) bySlot.set(s.slot_id, [])
    bySlot.get(s.slot_id)!.push(s)
  })

  const coveredSlots  = slots.filter((sl) => bySlot.has(sl.id)).length
  const totalApproved = stickers.length

  const leaderboard = [...members]
    .map((m) => ({
      ...m,
      completed: userSlots.get(m.user_id)?.size ?? 0,
    }))
    .sort((a, b) => b.completed - a.completed || (a.username ?? '').localeCompare(b.username ?? ''))

  const myRank = leaderboard.findIndex((m) => m.user_id === currentUserId) + 1

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-14 rounded-2xl bg-mundial-cream animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-mundial-cream animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Banner ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
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
            {coveredSlots}/{slots.length} slot{slots.length !== 1 ? 's' : ''} con sticker
          </span>
        </div>
        {myRank > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-mundial-purple/8 border border-mundial-purple/20 rounded-2xl">
            <span className="font-display text-sm text-mundial-purple">Tu posición: #{myRank}</span>
          </div>
        )}
      </div>

      {/* ── Galería por slot ──────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
          Galería
        </h3>

        {slots.length === 0 ? (
          <p className="text-sm text-mundial-purple/40 italic">Sin slots definidos en esta campaña.</p>
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
                  {/* Slot header */}
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

                  {/* Sticker row */}
                  {items.length === 0 ? (
                    <div className="px-4 py-5 text-center">
                      <p className="text-xs text-mundial-purple/30 font-condensed font-bold tracking-wider uppercase">
                        Sin stickers aprobados
                      </p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex gap-3 flex-wrap">
                        {items.map((s) => (
                          <div key={s.id} className="flex flex-col items-center gap-1.5 group">
                            <div className={[
                              'w-16 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 group-hover:scale-105',
                              s.user_id === currentUserId
                                ? 'border-mundial-yellow shadow-md'
                                : 'border-mundial-purple/10',
                            ].join(' ')}>
                              <img
                                src={s.image_url}
                                alt={`${s.username} · slot ${slot.slot_number}`}
                                className="w-full h-full object-contain bg-mundial-cream"
                              />
                            </div>
                            <p className={[
                              'text-[10px] font-condensed font-bold tracking-wider uppercase max-w-[64px] truncate text-center',
                              s.user_id === currentUserId ? 'text-mundial-yellow-dark' : 'text-mundial-purple/50',
                            ].join(' ')}>
                              {s.user_id === currentUserId ? 'Tú' : s.username}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Ranking ───────────────────────────────────────────── */}
      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}

      {members.length > 0 && slots.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Ranking · {members.length} participante{members.length !== 1 ? 's' : ''}
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-mundial-purple/8">
            {leaderboard.map((m, idx) => {
              const pct       = slots.length > 0 ? (m.completed / slots.length) * 100 : 0
              const isMe      = m.user_id === currentUserId
              const isFirst   = idx === 0 && m.completed > 0
              return (
                <div
                  key={m.user_id}
                  className={[
                    'flex items-center gap-4 px-5 py-3.5',
                    isMe ? 'bg-mundial-yellow/8' : '',
                  ].join(' ')}
                >
                  {/* Rank */}
                  <div className="w-7 text-center shrink-0">
                    {isFirst ? (
                      <span className="text-base">🥇</span>
                    ) : idx === 1 && m.completed > 0 ? (
                      <span className="text-base">🥈</span>
                    ) : idx === 2 && m.completed > 0 ? (
                      <span className="text-base">🥉</span>
                    ) : (
                      <span className="font-condensed text-xs font-bold text-mundial-purple/40">#{idx + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <button onClick={() => setProfileUserId(m.user_id)} className="hover:opacity-80 transition-opacity shrink-0">
                    <Avatar username={m.username ?? '?'} size="sm" />
                  </button>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProfileUserId(m.user_id)}
                        className={[
                          'font-display text-sm tracking-wider uppercase truncate hover:underline',
                          isMe ? 'text-mundial-purple font-bold' : 'text-mundial-purple',
                        ].join(' ')}
                      >
                        {isMe ? `${m.username} (tú)` : m.username}
                      </button>
                      {m.role === 'admin' && (
                        <span className="text-[9px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-yellow-dark bg-mundial-yellow/30 px-1.5 py-0.5 rounded-full shrink-0">
                          Org
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-mundial-purple/10 overflow-hidden">
                        <div
                          className={[
                            'h-full rounded-full transition-all duration-500',
                            pct === 100 ? 'bg-mundial-green' : isMe ? 'bg-mundial-yellow' : 'bg-mundial-purple/40',
                          ].join(' ')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-condensed text-[10px] font-bold text-mundial-purple/50 shrink-0 tabular-nums">
                        {m.completed}/{slots.length}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
