'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album } from '@/lib/supabase'
import CampaignDetail from './CampaignDetail'

interface Props {
  userId: string
}

interface CampaignEntry {
  album: Album
  portadaUrl: string | null
}

export default function OrganizerDashboard({ userId }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CampaignEntry | null>(null)

  const fetchAlbums = useCallback(async () => {
    setLoading(true)
    const { data: memberships } = await supabase
      .from('album_members')
      .select('album_id')
      .eq('user_id', userId)
      .eq('role', 'admin')

    if (!memberships || memberships.length === 0) {
      setCampaigns([])
      setLoading(false)
      return
    }

    const ids = memberships.map((m: { album_id: string }) => m.album_id)
    const { data } = await supabase
      .from('albums')
      .select('*, cover_edition:cover_editions(portada_url)')
      .in('id', ids)
      .order('created_at', { ascending: false })

    if (data) {
      setCampaigns(
        (data as (Album & { cover_edition: { portada_url: string } | null })[]).map((a) => ({
          album: a as Album,
          portadaUrl: (a.cover_edition as { portada_url: string } | null)?.portada_url ?? null,
        }))
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAlbums() }, [fetchAlbums])

  if (selected) {
    return (
      <CampaignDetail
        album={selected.album}
        currentUserId={userId}
        canAssignAdmin={false}
        userRole="admin"
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
            Mis Campañas
          </h2>
        </div>
        {!loading && (
          <p className="ml-5 text-sm text-mundial-purple/60">
            {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''} asignada{campaigns.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-mundial-cream animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-mundial-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p className="font-display text-lg tracking-wider uppercase text-mundial-purple/60">Sin campañas asignadas</p>
          <p className="text-sm text-mundial-purple/40">El superadmin todavía no te asignó a ninguna campaña.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {campaigns.map(({ album, portadaUrl }) => (
            <button
              key={album.id}
              onClick={() => setSelected({ album, portadaUrl })}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left"
            >
              {/* Cover image or placeholder */}
              {portadaUrl ? (
                <img
                  src={portadaUrl}
                  alt={album.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-mundial-yellow-dark/80 to-mundial-purple flex items-center justify-center">
                  <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

              {/* Organizer badge */}
              <div className="absolute top-2.5 right-2.5">
                <span className="text-[9px] font-condensed font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-full bg-mundial-yellow text-mundial-purple">
                  Organizador
                </span>
              </div>

              {/* Name overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
                <p className="font-display text-sm tracking-wide uppercase text-white leading-tight line-clamp-2">
                  {album.name}
                </p>
                {album.description && (
                  <p className="text-[10px] text-white/60 mt-0.5 truncate font-condensed">
                    {album.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
