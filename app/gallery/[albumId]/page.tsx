import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Sticker {
  id: string
  image_url: string
  slot_id: string
  username: string
  reactions: { emoji: string; count: number }[]
}

interface Slot {
  id: string
  slot_number: number
  label: string | null
}

async function getGalleryData(albumId: string) {
  const db = createClient(supabaseUrl, supabaseAnon)

  const { data: album } = await db
    .from('albums')
    .select('id, name, description, is_public')
    .eq('id', albumId)
    .single()

  if (!album || !album.is_public) return null

  const { data: stickersRaw } = await db
    .from('stickers')
    .select('id, image_url, slot_id, user_id')
    .eq('album_id', albumId)
    .eq('status', 'approved')

  const userIds = Array.from(new Set((stickersRaw ?? []).map((s: { user_id: string }) => s.user_id)))
  const { data: profiles } = userIds.length > 0
    ? await db.from('profiles').select('user_id, username').in('user_id', userIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p: { user_id: string; username: string | null }) => [p.user_id, p.username]))

  const stickers: Sticker[] = (stickersRaw ?? []).map((s: { id: string; image_url: string; slot_id: string; user_id: string }) => ({
    id: s.id,
    image_url: s.image_url,
    slot_id: s.slot_id,
    username: (profileMap.get(s.user_id) ?? s.user_id.slice(0, 8)) as string,
  }))

  const stickerIds = stickers.map((s) => s.id)
  const { data: reactionsRaw } = stickerIds.length > 0
    ? await db.from('sticker_reactions').select('sticker_id, emoji').in('sticker_id', stickerIds)
    : { data: [] }

  // sticker_id → emoji → count
  const reactionMap = new Map<string, Map<string, number>>()
  ;(reactionsRaw ?? []).forEach((r: { sticker_id: string; emoji: string }) => {
    if (!reactionMap.has(r.sticker_id)) reactionMap.set(r.sticker_id, new Map())
    const byEmoji = reactionMap.get(r.sticker_id)!
    byEmoji.set(r.emoji, (byEmoji.get(r.emoji) ?? 0) + 1)
  })

  const stickersWithReactions: Sticker[] = stickers.map((s) => {
    const byEmoji = reactionMap.get(s.id)
    const reactions: { emoji: string; count: number }[] = []
    byEmoji?.forEach((count, emoji) => reactions.push({ emoji, count }))
    reactions.sort((a, b) => b.count - a.count)
    return { ...s, reactions }
  })

  const { data: slotsRaw } = await db
    .from('album_slots')
    .select('id, slot_number, label')
    .eq('album_id', albumId)
    .order('slot_number')

  const slots: Slot[] = (slotsRaw ?? []) as Slot[]
  const bySlot = new Map<string, Sticker[]>()
  stickersWithReactions.forEach((s) => {
    if (!bySlot.has(s.slot_id)) bySlot.set(s.slot_id, [])
    bySlot.get(s.slot_id)!.push(s)
  })

  return { album, stickers: stickersWithReactions, slots, bySlot }
}

export async function generateMetadata({ params }: { params: { albumId: string } }): Promise<Metadata> {
  const data = await getGalleryData(params.albumId)
  if (!data) return { title: 'Galería no encontrada' }
  return {
    title: `${data.album.name} · Galería pública · MyAlbum`,
    description: data.album.description ?? `Galería de stickers del álbum ${data.album.name}`,
  }
}

export default async function PublicGalleryPage({ params }: { params: { albumId: string } }) {
  const data = await getGalleryData(params.albumId)
  if (!data) notFound()

  const { album, stickers, slots, bySlot } = data
  const filledSlots = slots.filter((sl) => bySlot.has(sl.id))

  return (
    <div className="min-h-screen bg-mundial-cream">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-mundial-cream/90 backdrop-blur border-b border-mundial-purple/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-mundial-purple flex items-center justify-center shrink-0">
              <span className="font-display text-sm text-white font-bold">M</span>
            </div>
            <div>
              <p className="font-display text-xs tracking-widest uppercase text-mundial-purple/50">MyAlbum</p>
              <h1 className="font-display text-sm tracking-wider uppercase text-mundial-purple leading-tight">{album.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/explore"
              className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40 hover:text-mundial-purple transition-colors"
            >
              Explorar
            </a>
            <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40 bg-mundial-purple/8 px-2 py-1 rounded-full">
              {stickers.length} sticker{stickers.length !== 1 ? 's' : ''} aprobados
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {stickers.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-condensed text-sm font-bold tracking-wider uppercase text-mundial-purple/30">
              Este álbum aún no tiene stickers aprobados
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-mundial-yellow/15 border border-mundial-yellow/40 rounded-2xl">
                <span className="font-condensed text-sm font-bold text-mundial-purple">
                  {stickers.length} sticker{stickers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-mundial-green/10 border border-mundial-green/30 rounded-2xl">
                <span className="font-condensed text-sm font-bold text-mundial-purple">
                  {filledSlots.length}/{slots.length} slots cubiertos
                </span>
              </div>
            </div>

            {/* Gallery grid by slot */}
            <div className="space-y-4">
              {slots.map((slot) => {
                const items = bySlot.get(slot.id) ?? []
                if (items.length === 0) return null
                return (
                  <div key={slot.id} className="rounded-2xl overflow-hidden border border-mundial-purple/10 bg-white/70">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-mundial-purple/8">
                      <div className="w-7 h-7 rounded-lg bg-mundial-purple/10 flex items-center justify-center shrink-0">
                        <span className="font-display text-xs text-mundial-purple font-bold">{slot.slot_number}</span>
                      </div>
                      <span className="font-display text-sm tracking-wider uppercase text-mundial-purple">
                        {slot.label ?? <span className="text-mundial-purple/40 italic text-xs">Sin etiqueta</span>}
                      </span>
                      <span className="ml-auto font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40">
                        {items.length} versión{items.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    <div className="p-4 flex flex-wrap gap-4">
                      {items.map((s) => (
                        <div key={s.id} className="flex flex-col items-center gap-1.5">
                          <div className="w-20 h-[100px] rounded-xl overflow-hidden border-2 border-mundial-purple/10">
                            <img
                              src={s.image_url}
                              alt={`Sticker de ${s.username}`}
                              className="w-full h-full object-contain bg-mundial-cream"
                            />
                          </div>
                          <span className="text-[10px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/50 max-w-[80px] truncate text-center">
                            {s.username}
                          </span>
                          {s.reactions.length > 0 && (
                            <div className="flex items-center gap-0.5 flex-wrap justify-center max-w-[90px]">
                              {s.reactions.slice(0, 4).map(({ emoji, count }) => (
                                <span
                                  key={emoji}
                                  className="flex items-center gap-0.5 text-[9px] font-condensed font-bold text-mundial-purple/60 bg-mundial-purple/6 px-1 py-0.5 rounded-full"
                                >
                                  <span className="text-[10px]">{emoji}</span>
                                  {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <footer className="pt-8 text-center">
          <p className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/30">
            MyAlbum · Galería pública
          </p>
        </footer>
      </main>
    </div>
  )
}
