'use client'

import { useState, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
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

interface CommentWithUser {
  id: string
  user_id: string
  content: string
  created_at: string
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
  const [toggling, setToggling]           = useState<string | null>(null)
  const [sharing, setSharing]             = useState<string | null>(null)
  const [filterUserId, setFilterUserId]   = useState<string | null>(null)
  const [filterSlot, setFilterSlot]       = useState<'all' | 'with' | 'without'>('all')
  const [sortBy, setSortBy]               = useState<'slot' | 'reactions' | 'comments'>('slot')
  const [exporting, setExporting]         = useState(false)
  const [commentSticker, setCommentSticker]       = useState<ApprovedSticker | null>(null)
  const [comments, setComments]                   = useState<CommentWithUser[]>([])
  const [commentCounts, setCommentCounts]         = useState<Map<string, number>>(new Map())
  const [commentText, setCommentText]             = useState('')
  const [loadingComments, setLoadingComments]     = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

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

    // Comment counts
    const { data: countsRaw } = await supabase
      .from('sticker_comments')
      .select('sticker_id')
      .eq('album_id', album.id)
    const cMap = new Map<string, number>()
    ;(countsRaw ?? []).forEach((r: { sticker_id: string }) => {
      cMap.set(r.sticker_id, (cMap.get(r.sticker_id) ?? 0) + 1)
    })

    setStickers(parsed)
    setUserSlots(us)
    setReactions(rx)
    setCommentCounts(cMap)
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

  const openComments = async (sticker: ApprovedSticker) => {
    setCommentSticker(sticker)
    setComments([])
    setCommentText('')
    setLoadingComments(true)
    const { data } = await supabase
      .from('sticker_comments')
      .select('id, user_id, content, created_at')
      .eq('sticker_id', sticker.id)
      .order('created_at', { ascending: true })
    if (data && data.length > 0) {
      const uids = Array.from(new Set((data as { user_id: string }[]).map((c) => c.user_id)))
      const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', uids)
      const pMap = new Map((profs ?? []).map((p: { user_id: string; username: string | null }) => [p.user_id, p.username]))
      setComments((data as { id: string; user_id: string; content: string; created_at: string }[]).map((c) => ({
        ...c, username: (pMap.get(c.user_id) ?? c.user_id.slice(0, 8)) as string,
      })))
    }
    setLoadingComments(false)
  }

  const submitComment = async () => {
    if (!commentSticker || !commentText.trim() || submittingComment) return
    setSubmittingComment(true)
    const content = commentText.trim()
    const { data, error } = await supabase
      .from('sticker_comments')
      .insert({ sticker_id: commentSticker.id, album_id: album.id, user_id: currentUserId, content })
      .select('id, user_id, content, created_at')
      .single()
    if (!error && data) {
      const { data: prof } = await supabase.from('profiles').select('username').eq('user_id', currentUserId).single()
      const newComment: CommentWithUser = { ...(data as { id: string; user_id: string; content: string; created_at: string }), username: prof?.username ?? currentUserId.slice(0, 8) }
      setComments((prev) => [...prev, newComment])
      setCommentCounts((prev) => {
        const next = new Map(prev)
        next.set(commentSticker.id, (next.get(commentSticker.id) ?? 0) + 1)
        return next
      })
      setCommentText('')
    }
    setSubmittingComment(false)
  }

  const deleteComment = async (commentId: string) => {
    if (!commentSticker) return
    await supabase.from('sticker_comments').delete().eq('id', commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setCommentCounts((prev) => {
      const next = new Map(prev)
      next.set(commentSticker.id, Math.max(0, (next.get(commentSticker.id) ?? 1) - 1))
      return next
    })
  }

  const handleExport = async () => {
    if (exporting || stickers.length === 0) return
    setExporting(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder(album.name) ?? zip
      await Promise.all(
        stickers.map(async (s) => {
          try {
            const res = await fetch(s.image_url)
            const blob = await res.blob()
            const ext = blob.type.includes('png') ? 'png' : 'jpg'
            folder.file(`${s.username}-slot.${ext}`, blob)
          } catch {
            // skip failed images
          }
        })
      )
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${album.name.replace(/\s+/g, '_')}_stickers.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setExporting(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────
  const isAlbumAdmin = members.some((m) => m.user_id === currentUserId && m.role === 'admin')

  const bySlot = new Map<string, ApprovedSticker[]>()
  stickers.forEach((s) => {
    if (!bySlot.has(s.slot_id)) bySlot.set(s.slot_id, [])
    bySlot.get(s.slot_id)!.push(s)
  })

  const coveredSlots  = slots.filter((sl) => bySlot.has(sl.id)).length
  const totalApproved = stickers.length

  const visibleSlots = slots.filter((sl) => {
    const items = bySlot.get(sl.id) ?? []
    if (filterSlot === 'with' && items.length === 0) return false
    if (filterSlot === 'without' && items.length > 0) return false
    if (filterUserId) {
      const filtered = items.filter((s) => s.user_id === filterUserId)
      return filtered.length > 0 || filterSlot !== 'with'
    }
    return true
  })

  const slotScore = (slotId: string): number => {
    const items = bySlot.get(slotId) ?? []
    if (sortBy === 'reactions') {
      return items.reduce((acc, s) => {
        let r = 0; reactions.get(s.id)?.forEach((set) => { r += set.size }); return acc + r
      }, 0)
    }
    if (sortBy === 'comments') {
      return items.reduce((acc, s) => acc + (commentCounts.get(s.id) ?? 0), 0)
    }
    return 0
  }

  const sortedVisibleSlots = sortBy === 'slot'
    ? visibleSlots
    : [...visibleSlots].sort((a, b) => slotScore(b.id) - slotScore(a.id))

  const leaderboard = [...members]
    .map((m) => ({ ...m, completed: userSlots.get(m.user_id)?.size ?? 0 }))
    .sort((a, b) => b.completed - a.completed || (a.username ?? '').localeCompare(b.username ?? ''))

  // ── Highlights (solo si hay stickers) ────────────────────────────
  const highlights = stickers.length > 0 ? (() => {
    const totalReactions = (s: ApprovedSticker) => {
      const byEmoji = reactions.get(s.id)
      if (!byEmoji) return 0
      let total = 0
      byEmoji.forEach((set) => { total += set.size })
      return total
    }

    const mostReacted  = [...stickers].sort((a, b) => totalReactions(b) - totalReactions(a))[0]
    const mostCommented = [...stickers].sort((a, b) => (commentCounts.get(b.id) ?? 0) - (commentCounts.get(a.id) ?? 0))[0]

    const topByEmoji = EMOJIS.map((emoji) => {
      const best = [...stickers].sort(
        (a, b) => (reactions.get(b.id)?.get(emoji)?.size ?? 0) - (reactions.get(a.id)?.get(emoji)?.size ?? 0)
      )[0]
      const count = reactions.get(best.id)?.get(emoji)?.size ?? 0
      return { emoji, sticker: best, count }
    }).filter((e) => e.count > 0)

    return { mostReacted, mostCommented, totalReactionsCount: totalReactions(mostReacted), topByEmoji }
  })() : null

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

        {stickers.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto flex items-center gap-2 px-4 py-3 bg-mundial-purple/8 border border-mundial-purple/20 rounded-2xl hover:bg-mundial-purple/15 disabled:opacity-50 transition-all"
          >
            {exporting ? (
              <svg className="w-4 h-4 text-mundial-purple animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-mundial-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {exporting ? 'Exportando…' : 'Exportar ZIP'}
            </span>
          </button>
        )}
      </div>

      {/* ── Galería por slot ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50 mr-1">
            Galería
          </h3>

          {/* Slot status filter */}
          {(['all', 'with', 'without'] as const).map((opt) => {
            const label = opt === 'all' ? 'Todos' : opt === 'with' ? 'Con sticker' : 'Sin sticker'
            return (
              <button
                key={opt}
                onClick={() => setFilterSlot(opt)}
                className={[
                  'px-3 py-1 rounded-full font-condensed text-[10px] font-bold tracking-wider uppercase transition-all',
                  filterSlot === opt
                    ? 'bg-mundial-purple text-white'
                    : 'bg-mundial-purple/8 text-mundial-purple/50 hover:bg-mundial-purple/15',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}

          {/* User filter */}
          {stickers.length > 0 && (
            <select
              value={filterUserId ?? ''}
              onChange={(e) => setFilterUserId(e.target.value || null)}
              className="px-3 py-1 rounded-full font-condensed text-[10px] font-bold tracking-wider uppercase bg-mundial-purple/8 text-mundial-purple/50 border-0 focus:outline-none focus:bg-mundial-purple/15 transition-all cursor-pointer appearance-none pr-6"
            >
              <option value="">Todos los usuarios</option>
              {Array.from(new Map(stickers.map((s) => [s.user_id, s.username]))).map(([uid, uname]) => (
                <option key={uid} value={uid}>{uname}</option>
              ))}
            </select>
          )}

          {(filterSlot !== 'all' || filterUserId) && (
            <button
              onClick={() => { setFilterSlot('all'); setFilterUserId(null) }}
              className="px-2 py-1 rounded-full font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-red/60 hover:text-mundial-red hover:bg-mundial-red/8 transition-all"
            >
              × Limpiar
            </button>
          )}

          {/* Ordenar */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="font-condensed text-[9px] font-bold tracking-[0.2em] uppercase text-mundial-purple/30 mr-0.5">Ordenar:</span>
            {([
              { key: 'slot',      label: '# Slot'     },
              { key: 'reactions', label: '❤️ Reac.'   },
              { key: 'comments',  label: '💬 Coment.' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={[
                  'px-2.5 py-1 rounded-full font-condensed text-[10px] font-bold tracking-wider uppercase transition-all',
                  sortBy === key
                    ? 'bg-mundial-purple text-white'
                    : 'bg-mundial-purple/8 text-mundial-purple/50 hover:bg-mundial-purple/15',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="text-sm text-mundial-purple/40 italic">Sin slots definidos en esta campaña.</p>
        ) : visibleSlots.length === 0 ? (
          <p className="text-sm text-mundial-purple/40 italic py-4 text-center">Sin resultados para los filtros aplicados.</p>
        ) : (
          <div className="space-y-4">
            {sortedVisibleSlots.map((slot) => {
              const allItems = bySlot.get(slot.id) ?? []
              const items = filterUserId ? allItems.filter((s) => s.user_id === filterUserId) : allItems
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

                              {/* Comment button */}
                              <button
                                onClick={() => openComments(s)}
                                className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] hover:bg-mundial-purple/8 text-mundial-purple/40 hover:text-mundial-purple transition-all leading-none"
                                aria-label="Ver comentarios"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {(commentCounts.get(s.id) ?? 0) > 0 && (
                                  <span className="font-condensed font-bold text-[9px]">{commentCounts.get(s.id)}</span>
                                )}
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
      {/* ── Highlights ───────────────────────────────────────────── */}
      {highlights && (
        <section className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Destacados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Más reaccionado */}
            {highlights.totalReactionsCount > 0 && (
              <div
                className="glass-card rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-mundial-yellow/5 transition-colors"
                onClick={() => openComments(highlights.mostReacted)}
              >
                <img
                  src={highlights.mostReacted.image_url}
                  alt=""
                  className="w-10 h-12 object-contain rounded-lg border border-mundial-purple/10 bg-mundial-cream shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/40 mb-0.5">
                    Más reaccionado
                  </p>
                  <p className="font-display text-sm text-mundial-purple truncate">{highlights.mostReacted.username}</p>
                  <p className="font-condensed text-xs font-bold text-mundial-yellow-dark">
                    {highlights.totalReactionsCount} reacción{highlights.totalReactionsCount !== 1 ? 'es' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Más comentado */}
            {(commentCounts.get(highlights.mostCommented.id) ?? 0) > 0 && (
              <div
                className="glass-card rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-mundial-purple/5 transition-colors"
                onClick={() => openComments(highlights.mostCommented)}
              >
                <img
                  src={highlights.mostCommented.image_url}
                  alt=""
                  className="w-10 h-12 object-contain rounded-lg border border-mundial-purple/10 bg-mundial-cream shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/40 mb-0.5">
                    Más comentado
                  </p>
                  <p className="font-display text-sm text-mundial-purple truncate">{highlights.mostCommented.username}</p>
                  <p className="font-condensed text-xs font-bold text-mundial-purple/60">
                    {commentCounts.get(highlights.mostCommented.id)} comentario{commentCounts.get(highlights.mostCommented.id) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Top por emoji */}
          {highlights.topByEmoji.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {highlights.topByEmoji.map(({ emoji, sticker, count }) => (
                <div
                  key={emoji}
                  className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl cursor-pointer hover:bg-mundial-yellow/5 transition-colors"
                  onClick={() => openComments(sticker)}
                >
                  <span className="text-base">{emoji}</span>
                  <div className="min-w-0">
                    <p className="font-display text-xs text-mundial-purple truncate max-w-[80px]">{sticker.username}</p>
                    <p className="font-condensed text-[10px] font-bold text-mundial-purple/40">{count}×</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Modal: Comentarios ────────────────────────────────────── */}
    {commentSticker && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) setCommentSticker(null) }}
      >
        <div className="w-full max-w-lg glass-card rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-mundial-purple/10 shrink-0">
            <img
              src={commentSticker.image_url}
              alt=""
              className="w-10 h-12 object-contain rounded-lg border border-mundial-purple/10 bg-mundial-cream shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm tracking-wide uppercase text-mundial-purple truncate">
                Sticker de {commentSticker.username}
              </p>
              <p className="text-xs text-mundial-purple/40">
                {comments.length} comentario{comments.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setCommentSticker(null)}
              className="w-8 h-8 rounded-xl hover:bg-mundial-purple/8 text-mundial-purple/40 hover:text-mundial-purple transition-colors flex items-center justify-center shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[80px]">
            {loadingComments ? (
              <div className="space-y-2">
                {[1,2].map((i) => <div key={i} className="h-10 rounded-xl bg-mundial-cream animate-pulse" />)}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-mundial-purple/30 py-6 font-condensed font-bold tracking-wider uppercase">
                Sin comentarios. ¡Sé el primero!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 group/comment">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-mundial-purple/10 flex items-center justify-center">
                    <span className="text-[10px] font-condensed font-bold text-mundial-purple/60 uppercase">
                      {c.username.slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-condensed font-bold tracking-wide uppercase text-mundial-purple/70">
                        {c.user_id === currentUserId ? 'Tú' : c.username}
                      </span>
                      <span className="text-[9px] text-mundial-purple/30">
                        {new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-mundial-purple/80 leading-snug break-words">{c.content}</p>
                  </div>
                  {(c.user_id === currentUserId || isAlbumAdmin) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="shrink-0 opacity-0 group-hover/comment:opacity-100 w-6 h-6 rounded-lg hover:bg-mundial-red/10 text-mundial-red/50 hover:text-mundial-red flex items-center justify-center transition-all"
                      aria-label="Eliminar comentario"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 p-4 border-t border-mundial-purple/10 shrink-0">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
              placeholder="Escribe un comentario…"
              maxLength={300}
              className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/15 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-purple/40 transition-colors"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || submittingComment}
              className="px-4 py-2 bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-40 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors shrink-0"
            >
              {submittingComment ? '…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
