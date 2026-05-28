'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album, type AlbumMember, type AlbumSlot, type Pack, type CollectionItem, type Sticker } from '@/lib/supabase'

interface RevealedSticker {
  sticker_id: string
  image_url: string
  slot_id: string
  slot_number: number
  slot_label: string | null
}

interface CollectionItemMeta extends CollectionItem {
  image_url: string
  slot_id: string
  slot_number: number
  slot_label: string | null
}

interface Props {
  album: Album
  currentUserId: string
  isAdminView: boolean
  slots: AlbumSlot[]
  members: AlbumMember[]
}

export default function AlbumView({ album, currentUserId, isAdminView, slots, members }: Props) {
  // ── Packs ──────────────────────────────────────────────────────
  const [myPacks, setMyPacks]           = useState<Pack[]>([])
  const [packsFetched, setPacksFetched] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [openingPackId, setOpeningPackId] = useState<string | null>(null)

  // Pool stats for admin
  const [poolCount, setPoolCount]     = useState<number | null>(null)
  const [totalPacks, setTotalPacks]   = useState<number | null>(null)

  // Reveal overlay
  const [revealed, setRevealed] = useState<RevealedSticker[] | null>(null)

  // ── Collection ─────────────────────────────────────────────────
  const [collection, setCollection]         = useState<CollectionItemMeta[]>([])
  const [collectionFetched, setCollectionFetched] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchMyPacks = useCallback(async () => {
    const { data } = await supabase
      .from('packs')
      .select('*')
      .eq('album_id', album.id)
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
    setMyPacks((data ?? []) as Pack[])
    setPacksFetched(true)
  }, [album.id, currentUserId])

  const fetchAdminStats = useCallback(async () => {
    const [{ count: approved }, { count: total }] = await Promise.all([
      supabase.from('stickers').select('id', { count: 'exact', head: true })
        .eq('album_id', album.id).eq('status', 'approved'),
      supabase.from('packs').select('id', { count: 'exact', head: true })
        .eq('album_id', album.id),
    ])
    setPoolCount(approved ?? 0)
    setTotalPacks(total ?? 0)
  }, [album.id])

  const fetchCollection = useCallback(async () => {
    const { data: rows } = await supabase
      .from('collection')
      .select('*')
      .eq('album_id', album.id)
      .eq('user_id', currentUserId)
    if (!rows || rows.length === 0) { setCollectionFetched(true); return }

    const stickerIds = Array.from(new Set((rows as CollectionItem[]).map((c) => c.sticker_id)))
    const { data: stickersData } = await supabase
      .from('stickers')
      .select('id, image_url, slot_id')
      .in('id', stickerIds)

    const stickerMap = new Map(
      ((stickersData ?? []) as { id: string; image_url: string; slot_id: string }[]).map((s) => [s.id, s])
    )
    const slotMap = new Map(slots.map((sl) => [sl.id, sl]))

    setCollection(
      (rows as CollectionItem[]).map((c) => {
        const s = stickerMap.get(c.sticker_id)
        const sl = s ? slotMap.get(s.slot_id) : undefined
        return {
          ...c,
          image_url:   s?.image_url ?? '',
          slot_id:     s?.slot_id ?? '',
          slot_number: sl?.slot_number ?? 0,
          slot_label:  sl?.label ?? null,
        }
      })
    )
    setCollectionFetched(true)
  }, [album.id, currentUserId, slots])

  useEffect(() => {
    fetchMyPacks()
    fetchCollection()
    if (isAdminView) fetchAdminStats()
  }, [fetchMyPacks, fetchCollection, fetchAdminStats, isAdminView])

  // ── Actions ────────────────────────────────────────────────────
  const handleGeneratePacks = async () => {
    setGenerateError(null)
    setIsGenerating(true)
    const { data, error } = await supabase.rpc('generate_packs', { p_album_id: album.id })
    if (error) {
      setGenerateError(
        error.message.includes('no approved stickers')
          ? 'No hay stickers aprobados en el pool todavía.'
          : error.message.includes('not authorized')
          ? 'Sin permisos.'
          : error.message
      )
    } else {
      await Promise.all([fetchMyPacks(), fetchAdminStats()])
    }
    setIsGenerating(false)
  }

  const handleOpenPack = async (packId: string) => {
    setOpeningPackId(packId)
    const { data, error } = await supabase.rpc('open_pack', { p_pack_id: packId })
    if (!error && data) {
      const result = data as { stickers: RevealedSticker[] }
      setRevealed(result.stickers ?? [])
      setMyPacks((prev) =>
        prev.map((p) => p.id === packId ? { ...p, status: 'opened' as const, opened_at: new Date().toISOString() } : p)
      )
      await fetchCollection()
    }
    setOpeningPackId(null)
  }

  // ── Derived: collection grouped by slot ───────────────────────
  const bySlot = new Map<string, CollectionItemMeta[]>()
  collection.forEach((c) => {
    const key = c.slot_id
    if (!bySlot.has(key)) bySlot.set(key, [])
    bySlot.get(key)!.push(c)
  })

  const sealedPacks  = myPacks.filter((p) => p.status === 'sealed')
  const openedCount  = myPacks.filter((p) => p.status === 'opened').length
  const approvedInCollection = new Set(
    collection.map((c) => c.slot_id)
  ).size

  return (
    <div className="space-y-7">

      {/* ── Admin: Distribuir Sobres ──────────────────────────── */}
      {isAdminView && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Distribuir Sobres
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-mundial-yellow/10 border border-mundial-yellow/30 rounded-xl">
              <svg className="w-4 h-4 text-mundial-yellow-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span className="font-condensed font-bold text-mundial-purple">
                {poolCount === null ? '…' : poolCount} stickers aprobados en el pool
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-mundial-purple/8 border border-mundial-purple/20 rounded-xl">
              <svg className="w-4 h-4 text-mundial-purple/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="font-condensed font-bold text-mundial-purple">
                {members.length} participante{members.length !== 1 ? 's' : ''}
              </span>
            </div>
            {totalPacks !== null && totalPacks > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-mundial-green/10 border border-mundial-green/30 rounded-xl">
                <span className="font-condensed font-bold text-mundial-purple">
                  {totalPacks} sobre{totalPacks !== 1 ? 's' : ''} distribuido{totalPacks !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGeneratePacks}
              disabled={isGenerating || poolCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-50 text-mundial-purple font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-mundial-purple/30 border-t-mundial-purple rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
                </svg>
              )}
              Generar 1 sobre por participante
            </button>
          </div>
          {generateError && (
            <p className="text-xs text-mundial-red">{generateError}</p>
          )}
        </div>
      )}

      {/* ── Mis Sobres (sealed) ───────────────────────────────── */}
      {packsFetched && sealedPacks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Mis sobres ({sealedPacks.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sealedPacks.map((pack) => (
              <div key={pack.id} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
                {/* Pack illustration */}
                <div className="relative">
                  <div className="w-16 h-20 rounded-xl bg-gradient-to-b from-mundial-yellow to-mundial-yellow-dark flex items-center justify-center shadow-md">
                    <svg className="w-8 h-8 text-mundial-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-mundial-purple flex items-center justify-center">
                    <span className="text-[9px] font-display text-white">{album.pack_size}</span>
                  </div>
                </div>
                <p className="font-condensed text-xs font-bold tracking-wider uppercase text-mundial-purple/60">
                  Sobre sellado
                </p>
                <button
                  onClick={() => handleOpenPack(pack.id)}
                  disabled={openingPackId === pack.id}
                  className="w-full py-2 bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-50 text-mundial-purple font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                >
                  {openingPackId === pack.id ? (
                    <div className="w-4 h-4 border-2 border-mundial-purple/30 border-t-mundial-purple rounded-full animate-spin mx-auto" />
                  ) : 'Abrir'}
                </button>
              </div>
            ))}
          </div>
          {openedCount > 0 && (
            <p className="text-xs text-mundial-purple/40 font-condensed">
              {openedCount} sobre{openedCount !== 1 ? 's' : ''} ya abierto{openedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {packsFetched && sealedPacks.length === 0 && myPacks.length === 0 && (
        <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-mundial-yellow-dark/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
            </svg>
          </div>
          <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin sobres</p>
          <p className="text-sm text-mundial-purple/35">El organizador todavía no distribuyó sobres.</p>
        </div>
      )}

      {/* ── Mi Colección ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Mi Colección
          </h3>
          <span className="text-xs font-condensed font-bold text-mundial-purple/40">
            {approvedInCollection}/{slots.length} slots completados
          </span>
        </div>

        {!collectionFetched || slots.length === 0 ? (
          slots.length === 0 ? (
            <p className="text-sm text-mundial-purple/40 italic">Sin slots definidos en esta campaña.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-mundial-cream animate-pulse" />
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((slot) => {
              const items = bySlot.get(slot.id) ?? []
              const first = items[0]
              const dupes = items.length
              return (
                <div key={slot.id} className="relative rounded-xl overflow-hidden border-2 border-mundial-purple/10 bg-white/70">
                  {first ? (
                    <div className="aspect-[3/4]">
                      <img src={first.image_url} alt="" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] flex items-center justify-center bg-mundial-cream/50">
                      <span className="font-display text-xl text-mundial-purple/20 font-bold">{slot.slot_number}</span>
                    </div>
                  )}
                  <div className="px-2 py-1.5 bg-white/90 border-t border-mundial-purple/10">
                    <p className="font-display text-[10px] tracking-wide uppercase text-mundial-purple truncate">
                      #{slot.slot_number}{slot.label ? ` ${slot.label}` : ''}
                    </p>
                  </div>
                  {dupes > 1 && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-mundial-purple text-white text-[9px] font-display rounded-full">
                      ×{dupes}
                    </div>
                  )}
                  {!first && (
                    <div className="absolute inset-0 bg-mundial-cream/40" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Reveal overlay ───────────────────────────────────── */}
      {revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <p className="font-display text-2xl tracking-wide uppercase text-mundial-purple">¡Sobre abierto!</p>
              <p className="text-sm text-mundial-purple/50">{revealed.length} cromo{revealed.length !== 1 ? 's' : ''} obtenido{revealed.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {revealed.map((s, i) => (
                <div key={i} className="rounded-xl overflow-hidden border-2 border-mundial-purple/10 bg-mundial-cream">
                  <div className="aspect-[3/4]">
                    <img src={s.image_url} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="px-2 py-1.5 bg-white border-t border-mundial-purple/10">
                    <p className="font-display text-[9px] tracking-wide uppercase text-mundial-purple truncate text-center">
                      #{s.slot_number}{s.slot_label ? ` ${s.slot_label}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRevealed(null)}
              className="w-full py-3 bg-mundial-yellow hover:bg-mundial-yellow-dark text-mundial-purple font-display text-sm tracking-wider uppercase rounded-xl transition-colors"
            >
              ¡Genial!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
