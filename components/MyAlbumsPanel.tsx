'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album } from '@/lib/supabase'
import AlbumDetail from './AlbumDetail'

interface Props {
  userId: string
}

export default function MyAlbumsPanel({ userId }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)

  const fetchMyAlbums = useCallback(async () => {
    setLoading(true)
    const { data: memberships } = await supabase
      .from('album_members')
      .select('album_id')
      .eq('user_id', userId)
      .eq('role', 'admin')

    if (!memberships || memberships.length === 0) { setAlbums([]); setLoading(false); return }

    const albumIds = memberships.map((m: { album_id: string }) => m.album_id)
    const { data } = await supabase
      .from('albums')
      .select('*')
      .in('id', albumIds)
      .order('created_at', { ascending: false })

    if (data) setAlbums(data as Album[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchMyAlbums() }, [fetchMyAlbums])

  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        currentUserId={userId}
        canAssignAdmin={false}
        onBack={() => setSelectedAlbum(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1.5 h-8 bg-mundial-green rounded-full" />
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
            Mis Álbumes
          </h2>
        </div>
        <p className="ml-5 text-sm text-mundial-purple/60">
          Álbumes que administrás · {albums.length} en total
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-green/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-mundial-green/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p className="font-display text-lg tracking-wider uppercase text-mundial-purple/60">
            Sin álbumes asignados
          </p>
          <p className="text-sm text-mundial-purple/40">
            El administrador del sistema te asignará como admin de un álbum.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => setSelectedAlbum(album)}
              className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-mundial-green/15 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-mundial-green/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base tracking-wide uppercase text-mundial-purple truncate">
                  {album.name}
                </p>
                {album.description && (
                  <p className="text-sm text-mundial-purple/60 truncate mt-0.5">{album.description}</p>
                )}
                <p className="text-xs text-mundial-purple/40 mt-1">
                  {new Date(album.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <svg className="w-5 h-5 text-mundial-purple/30 group-hover:text-mundial-green transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
