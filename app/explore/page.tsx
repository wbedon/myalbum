import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Explorar álbumes · MyAlbum',
  description: 'Descubrí álbumes de stickers públicos en MyAlbum.',
}

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface PublicAlbum {
  id: string
  name: string
  description: string | null
  stickerCount: number
  slotCount: number
}

async function getPublicAlbums(): Promise<PublicAlbum[]> {
  const db = createClient(supabaseUrl, supabaseAnon)

  const { data: albums } = await db
    .from('albums')
    .select('id, name, description')
    .eq('is_public', true)
    .order('name')

  if (!albums?.length) return []

  const albumIds = albums.map((a: { id: string }) => a.id)

  const { data: stickerCounts } = await db
    .from('stickers')
    .select('album_id')
    .in('album_id', albumIds)
    .eq('status', 'approved')

  const { data: slotCounts } = await db
    .from('album_slots')
    .select('album_id')
    .in('album_id', albumIds)

  const stickersByAlbum = new Map<string, number>()
  const slotsByAlbum    = new Map<string, number>()
  ;(stickerCounts ?? []).forEach((r: { album_id: string }) => {
    stickersByAlbum.set(r.album_id, (stickersByAlbum.get(r.album_id) ?? 0) + 1)
  })
  ;(slotCounts ?? []).forEach((r: { album_id: string }) => {
    slotsByAlbum.set(r.album_id, (slotsByAlbum.get(r.album_id) ?? 0) + 1)
  })

  return albums.map((a: { id: string; name: string; description: string | null }) => ({
    ...a,
    stickerCount: stickersByAlbum.get(a.id) ?? 0,
    slotCount:    slotsByAlbum.get(a.id)    ?? 0,
  }))
}

export default async function ExplorePage() {
  const albums = await getPublicAlbums()

  return (
    <div className="min-h-screen bg-mundial-cream">
      <header className="sticky top-0 z-10 bg-mundial-cream/90 backdrop-blur border-b border-mundial-purple/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mundial-purple flex items-center justify-center shrink-0">
            <span className="font-display text-sm text-white font-bold">M</span>
          </div>
          <div>
            <p className="font-display text-xs tracking-widest uppercase text-mundial-purple/50">MyAlbum</p>
            <h1 className="font-display text-sm tracking-wider uppercase text-mundial-purple leading-tight">Explorar álbumes</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {albums.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-condensed text-sm font-bold tracking-wider uppercase text-mundial-purple/30">
              Aún no hay álbumes públicos
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {albums.map((album) => {
              const pct = album.slotCount > 0
                ? Math.round((album.stickerCount / album.slotCount) * 100)
                : 0
              return (
                <Link
                  key={album.id}
                  href={`/gallery/${album.id}`}
                  className="block rounded-2xl bg-white/70 border border-mundial-purple/10 p-5 hover:border-mundial-purple/30 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-mundial-purple flex items-center justify-center shrink-0">
                      <span className="font-display text-base text-white font-bold">
                        {album.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-green bg-mundial-green/10 border border-mundial-green/20 px-2 py-1 rounded-full mt-0.5">
                      Público
                    </span>
                  </div>

                  <h2 className="font-display text-sm tracking-wider uppercase text-mundial-purple mb-1 group-hover:text-mundial-purple/70 transition-colors">
                    {album.name}
                  </h2>
                  {album.description && (
                    <p className="font-condensed text-xs text-mundial-purple/50 mb-3 line-clamp-2">
                      {album.description}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40">
                        {album.stickerCount} sticker{album.stickerCount !== 1 ? 's' : ''}
                      </span>
                      <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-mundial-purple/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-mundial-purple/30 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/30">
                      {album.stickerCount}/{album.slotCount} slots cubiertos
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <footer className="pt-12 text-center">
          <p className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/30">
            MyAlbum · Explorar
          </p>
        </footer>
      </main>
    </div>
  )
}
