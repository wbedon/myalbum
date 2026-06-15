'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album, type AlbumSlot, type AlbumMember } from '@/lib/supabase'
import Avatar from './Avatar'
import UserProfileModal from './UserProfileModal'

const EMOJIS = ['❤️', '🔥', '⭐', '😂'] as const
type Emoji = typeof EMOJIS[number]

// sticker_id → emoji → Set<user_id>
type ReactMap = Map<string, Map<string, Set<string>>>

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
  const [loading, setLoading]             = useState(true)
  const [stickers, setStickers]           = useState<ApprovedSticker[]>([])
  const [userSlots, setUserSlots]         = useState<Map<string, Set<string>>>(new Map())
  const [reactions, setReactions]         = useState<ReactMap>(new Map())
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [toggling, setToggling]           = useState<string | null>(null) // sticker_id+emoji key
  const [sharing, setSharing]             = useState<string | null>(null) // sticker id being shared

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // Approved stickers
    const { data: stickersRaw } = await supabase
      .from('stickers')
      .select('id, image_url, slot_id, user_id')
      .eq('album_id', album.id)
      .eq('status', 'approved')

    // Creator profiles
    const creatorIds = Array.from(new Set((stickersRaw ?? []).map((s: { user_id: string }) => s.user_id)))
    const { data: profilesRaw } = creatorIds.length > 0
      ? await supabase.from('profiles').select('user_id, username').in('user_id', creatorIds)
      : { data: [] }
    const profileMap = new Map(
      (profilesRaw ?? []).map((p: { user_id: string; username: string | null }) => [p.user_id, p.username])
    )

    const parsed: ApprovedSticker[] = (stickersRaw ?? []).map(
      (s: { id: string; image_url: string; slot_id: string; user_id: string }) => ({
        id:        s.id,
        image_url: s.image_url,
        slot_id:   s.slot_id,
        user_id:   s.user_id,
        username:  (profileMap.get(s.user_id) ?? s.user_id.slice(0, 8)) as string,
      })
    )

    // Collection for leaderboard
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

    // Reactions
    const { data: rxRaw } = await supabase
      .from('sticker_reactions')
      .select('sticker_id, user_id, emoji')
      .eq('album_id', album.id)

    const rx: ReactMap = new Map()
    for (const r of (rxRaw ?? []) as { sticker_id: string; user_id: string; emoji: string }[]) {
      if (!rx.has(r.sticker_id)) rx.set(r.sticker_id, new Map())
      const byEmoji = rx.get(r.sticker_id)!
      if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, new Set())
      byEmoji.get(r.emoji)!.add(r.user_id)
    }

    setStickers(parsed)
    setUserSlots(us)
    setReactions(rx)
    setLoading(false)
  }, [album.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggle(stickerId: string, emoji: Emoji) {
    const key = `${stickerId}:${emoji}`
    if (toggling === key) return
    setToggling(key)

    // Optimistic update
    setReactions((prev) => {
      const next = new Map(prev)
      const byEmoji = new Map(next.get(stickerId) ?? [])
      const users   = new Set(byEmoji.get(emoji) ?? [])
      if (users.has(currentUserId)) users.delete(currentUserId)
      else users.add(currentUserId)
      byEmoji.set(emoji, users)
      next.set(stickerId, byEmoji)
      return next
    })

    const { error } = await supabase.rpc('toggle_reaction', {
      p_sticker_id: stickerId,
      p_emoji:      emoji,
    })

    // Revert if error
    if (error) {
      setReactions((prev) => {
        const next = new Map(prev)
        const byEmoji = new Map(next.get(stickerId) ?? [])
        const users   = new Set(byEmoji.get(emoji) ?? [])
        if (users.has(currentUserId)) users.delete(currentUserId)
        else users.add(currentUserId)
        byEmoji.set(emoji, users)
        next.set(stickerId, byEmoji)
        return next
      })
    }

    setToggling(null)
  }

  const handleShare = async (stickerId: string, imageUrl: string, username: string) => {
    setSharing(stickerId)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `sticker-${username}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Sticker de ${username} · ${album.name}` })
      } else if (navigator.share) {
        await navigator.share({ url: imageUrl, title: `Sticker de ${username} · ${album.name}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sticker-${username}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        // share failed — fall back to download
        try {
          const r = await fetch(imageUrl)
          const b = await r.blob()
          const url = URL.createObjectURL(b)
          const a = document.createElement('a')
          a.href = url
          a.download = `sticker-${username}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {}
      }
    } finally {
      setSharing(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────
  const bySlot = new Map<string, ApprovedSticker[]>()
  stickers.forEach((s) => {
    if (!bySlot.has(s.slot_id)) bySlot.set(s.slot_id, [])
    bySlot.get(s.slot_id)!.push(s)
  })

  const coveredSlots  = slots.filter((sl) => bySlot.has(sl.id)).length
  const totalApproved = stickers.length

  const leaderboard = [...members]
    .map((m) => ({ ...m, completed: userSlots.get(m.user_id)?.size ?? 0 }))
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

      {/* ── Perfil modal ─────────────────────────────────────────── */}
      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}

      {/* ── Banners ──────────────────────────────────────────────── */}
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

      {/* ── Galería por slot ──────────────────────────────────────── */}
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

                  {/* Sticker cards */}
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
                          const isMe = s.user_id === currentUserId
                          const sxReactions = reactions.get(s.id)

                          return (
                            <div key={s.id} className="flex flex-col items-center gap-1.5 group">
                              {/* Sticker image */}
                              <div className={[
                                'relative w-20 h-[100px] rounded-xl overflow-hidden border-2 transition-all duration-200 group-hover:scale-105 cursor-pointer',
                                isMe
                                  ? 'border-mundial-yellow shadow-md'
                                  : 'border-mundial-purple/10',
                              ].join(' ')}
                                onClick={() => setProfileUserId(s.user_id)}
                              >
                                <img
                                  src={s.image_url}
                                  alt={`${s.username} · slot ${slot.slot_number}`}
                                  className="w-full h-full object-contain bg-mundial-cream"
                                />
                                {/* Share / download button */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleShare(s.id, s.image_url, s.username) }}
                                  disabled={sharing === s.id}
                                  aria-label="Compartir sticker"
                                  className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/50 hover:bg-black/70 disabled:opacity-50 text-white flex items-center justify-center transition-colors"
                                >
                                  {sharing === s.id ? (
                                    <span className="text-[8px] font-bold leading-none">…</span>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                  )}
                                </button>
                              </div>

                              {/* Creator name */}
                              <button
                                onClick={() => setProfileUserId(s.user_id)}
                                className={[
                                  'text-[10px] font-condensed font-bold tracking-wider uppercase max-w-[80px] truncate text-center hover:underline',
                                  isMe ? 'text-mundial-yellow-dark' : 'text-mundial-purple/50',
                                ].join(' ')}
                              >
                                {isMe ? 'Tú' : s.username}
                              </button>

                              {/* Reaction bar */}
                              <div className="flex items-center gap-0.5">
                                {EMOJIS.map((emoji) => {
                                  const count   = sxReactions?.get(emoji)?.size ?? 0
                                  const reacted = sxReactions?.get(emoji)?.has(currentUserId) ?? false
                                  const isActive = toggling === `${s.id}:${emoji}`
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggle(s.id, emoji)}
                                      disabled={isActive}
                                      title={emoji}
                                      className={[
                                        'flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] transition-all leading-none',
                                        reacted
                                          ? 'bg-mundial-yellow/30 text-mundial-purple scale-110'
                                          : 'hover:bg-mundial-purple/8 text-mundial-purple/40 hover:text-mundial-purple',
                                        count === 0 && !reacted ? 'opacity-40' : '',
                                      ].join(' ')}
                                    >
                                      <span className="text-[11px]">{emoji}</span>
                                      {count > 0 && (
                                        <span className="font-condensed font-bold text-[9px]">{count}</span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
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
      {members.length > 0 && slots.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Ranking · {members.length} participante{members.length !== 1 ? 's' : ''}
          </h3>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-mundial-purple/8">
            {leaderboard.map((m, idx) => {
              const pct     = slots.length > 0 ? (m.completed / slots.length) * 100 : 0
              const isMe    = m.user_id === currentUserId
              const isFirst = idx === 0 && m.completed > 0
              return (
                <div
                  key={m.user_id}
                  className={['flex items-center gap-4 px-5 py-3.5', isMe ? 'bg-mundial-yellow/8' : ''].join(' ')}
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
