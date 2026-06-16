import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Sticker {
  id: string
  image_url: string
  album_id: string
  album_name: string
}

async function getProfileData(username: string) {
  const db = createClient(supabaseUrl, supabaseAnon)

  const { data: profile } = await db
    .from('profiles')
    .select('user_id, username, bio')
    .eq('username', username)
    .single()

  if (!profile) return null

  const { data: stickersRaw } = await db
    .from('stickers')
    .select('id, image_url, album_id')
    .eq('user_id', profile.user_id)
    .eq('status', 'approved')

  if (!stickersRaw?.length) return { profile, stickers: [], albums: new Map<string, string>() }

  const albumIds = Array.from(new Set(stickersRaw.map((s: { album_id: string }) => s.album_id)))

  const { data: albumsRaw } = await db
    .from('albums')
    .select('id, name')
    .in('id', albumIds)
    .eq('is_public', true)

  const albumMap = new Map<string, string>(
    (albumsRaw ?? []).map((a: { id: string; name: string }) => [a.id, a.name])
  )

  const stickers: Sticker[] = stickersRaw
    .filter((s: { album_id: string }) => albumMap.has(s.album_id))
    .map((s: { id: string; image_url: string; album_id: string }) => ({
      id:         s.id,
      image_url:  s.image_url,
      album_id:   s.album_id,
      album_name: albumMap.get(s.album_id)!,
    }))

  return { profile, stickers, albums: albumMap }
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const data = await getProfileData(params.username)
  if (!data) return { title: 'Perfil no encontrado' }
  return {
    title: `${data.profile.username} · MyAlbum`,
    description: data.profile.bio ?? `Perfil de ${data.profile.username} en MyAlbum`,
  }
}

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const data = await getProfileData(params.username)
  if (!data) notFound()

  const { profile, stickers, albums } = data

  // Group stickers by album
  const byAlbum = new Map<string, Sticker[]>()
  stickers.forEach((s) => {
    if (!byAlbum.has(s.album_id)) byAlbum.set(s.album_id, [])
    byAlbum.get(s.album_id)!.push(s)
  })

  const initials = (profile.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-mundial-cream">
      <header className="sticky top-0 z-10 bg-mundial-cream/90 backdrop-blur border-b border-mundial-purple/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mundial-purple flex items-center justify-center shrink-0">
            <span className="font-display text-sm text-white font-bold">M</span>
          </div>
          <p className="font-display text-xs tracking-widest uppercase text-mundial-purple/50">MyAlbum</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Profile card */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-mundial-purple flex items-center justify-center shrink-0 shadow-lg">
            <span className="font-display text-xl text-white font-bold">{initials}</span>
          </div>
          <div>
            <h1 className="font-display text-lg tracking-wider uppercase text-mundial-purple">
              {profile.username}
            </h1>
            {profile.bio && (
              <p className="font-condensed text-sm text-mundial-purple/60 mt-0.5">{profile.bio}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple bg-mundial-yellow/20 border border-mundial-yellow/40 px-2 py-0.5 rounded-full">
                {stickers.length} sticker{stickers.length !== 1 ? 's' : ''} aprobados
              </span>
              {albums.size > 0 && (
                <span className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/50 bg-mundial-purple/8 px-2 py-0.5 rounded-full">
                  {albums.size} álbum{albums.size !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stickers by album */}
        {stickers.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-condensed text-sm font-bold tracking-wider uppercase text-mundial-purple/30">
              Aún no tiene stickers aprobados en álbumes públicos
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(byAlbum.entries()).map(([albumId, items]) => (
              <div key={albumId} className="rounded-2xl overflow-hidden border border-mundial-purple/10 bg-white/70">
                <div className="flex items-center justify-between px-4 py-3 border-b border-mundial-purple/8">
                  <span className="font-display text-sm tracking-wider uppercase text-mundial-purple">
                    {albums.get(albumId)}
                  </span>
                  <a
                    href={`/gallery/${albumId}`}
                    className="font-condensed text-[10px] font-bold tracking-wider uppercase text-mundial-purple/40 hover:text-mundial-purple transition-colors"
                  >
                    Ver galería →
                  </a>
                </div>
                <div className="p-4 flex flex-wrap gap-4">
                  {items.map((s) => (
                    <div key={s.id} className="w-20 h-[100px] rounded-xl overflow-hidden border-2 border-mundial-purple/10">
                      <img
                        src={s.image_url}
                        alt={`Sticker de ${profile.username}`}
                        className="w-full h-full object-contain bg-mundial-cream"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="pt-8 text-center">
          <p className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/30">
            MyAlbum · Perfil público
          </p>
        </footer>
      </main>
    </div>
  )
}
