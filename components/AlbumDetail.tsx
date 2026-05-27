'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album, type AlbumMember } from '@/lib/supabase'

interface Props {
  album: Album
  currentUserId: string
  canAssignAdmin: boolean
  onBack: () => void
}

export default function AlbumDetail({ album, currentUserId, canAssignAdmin, onBack }: Props) {
  const [members, setMembers] = useState<AlbumMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adminUsername, setAdminUsername] = useState('')
  const [memberUsername, setMemberUsername] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('album_members')
      .select('album_id, user_id, role, added_by, created_at')
      .eq('album_id', album.id)
      .order('role', { ascending: false }) // admins primero
    if (!rows) { setLoading(false); return }

    const userIds = rows.map((r: { user_id: string }) => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username')
      .in('user_id', userIds)

    setMembers(
      rows.map((r: { album_id: string; user_id: string; role: string; added_by: string | null; created_at: string }) => ({
        ...r,
        role: r.role as 'admin' | 'member',
        added_by: r.added_by ?? null,
        username: profiles?.find((p: { user_id: string; username: string | null }) => p.user_id === r.user_id)?.username ?? r.user_id.slice(0, 8),
      }))
    )
    setLoading(false)
  }, [album.id])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const findUserByUsername = async (username: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username')
      .eq('username', username.trim())
      .single()
    return data
  }

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError(null)
    setIsAssigning(true)
    try {
      const profile = await findUserByUsername(adminUsername)
      if (!profile) throw new Error(`Usuario "${adminUsername}" no encontrado.`)

      const { error } = await supabase.from('album_members').upsert({
        album_id: album.id,
        user_id: profile.user_id,
        role: 'admin',
        added_by: currentUserId,
      }, { onConflict: 'album_id,user_id' })
      if (error) throw error

      setAdminUsername('')
      await fetchMembers()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Error al asignar admin.')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemberError(null)
    setIsAdding(true)
    try {
      const profile = await findUserByUsername(memberUsername)
      if (!profile) throw new Error(`Usuario "${memberUsername}" no encontrado.`)

      const already = members.find((m) => m.user_id === profile.user_id)
      if (already) throw new Error(`"${memberUsername}" ya es ${already.role === 'admin' ? 'administrador' : 'miembro'} de este álbum.`)

      const { error } = await supabase.from('album_members').insert({
        album_id: album.id,
        user_id: profile.user_id,
        role: 'member',
        added_by: currentUserId,
      })
      if (error) throw error

      setMemberUsername('')
      await fetchMembers()
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Error al agregar miembro.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    await supabase.from('album_members').delete().eq('album_id', album.id).eq('user_id', userId)
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    setRemovingId(null)
  }

  const admins  = members.filter((m) => m.role === 'admin')
  const regular = members.filter((m) => m.role === 'member')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-mundial-purple/60 hover:text-mundial-purple font-condensed font-bold tracking-wider uppercase mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Álbumes
        </button>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple leading-tight">
              {album.name}
            </h2>
            {album.description && (
              <p className="text-sm text-mundial-purple/60 mt-0.5">{album.description}</p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── ADMINISTRADOR ────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
              Administrador del álbum
            </h3>

            {admins.length === 0 ? (
              <p className="text-sm text-mundial-purple/40 italic">Sin administrador asignado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {admins.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 px-3 py-1.5 bg-mundial-yellow/20 border border-mundial-yellow/50 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-mundial-yellow/50 flex items-center justify-center text-[10px] font-bold text-mundial-purple">
                      {(m.username ?? '?')[0].toUpperCase()}
                    </div>
                    <span className="font-display text-sm tracking-wider text-mundial-purple">{m.username}</span>
                    <span className="text-[9px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-yellow-dark bg-mundial-yellow/40 px-1.5 py-0.5 rounded-full">
                      Admin
                    </span>
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      disabled={removingId === m.user_id}
                      className="text-mundial-purple/30 hover:text-mundial-red transition-colors ml-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {canAssignAdmin && (
              <form onSubmit={handleAssignAdmin} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  required
                  className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-yellow focus:ring-2 focus:ring-mundial-yellow/20 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-60 text-mundial-purple font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                >
                  {isAssigning ? '…' : 'Asignar'}
                </button>
              </form>
            )}
            {adminError && <p className="text-xs text-mundial-red">{adminError}</p>}
          </div>

          {/* ── MIEMBROS ─────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
              Miembros ({regular.length})
            </h3>

            {regular.length === 0 ? (
              <p className="text-sm text-mundial-purple/40 italic">Sin miembros todavía.</p>
            ) : (
              <div className="grid gap-2">
                {regular.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-white/60 rounded-xl group">
                    <div className="w-8 h-8 rounded-full bg-mundial-purple/10 flex items-center justify-center text-sm font-bold text-mundial-purple">
                      {(m.username ?? '?')[0].toUpperCase()}
                    </div>
                    <span className="flex-1 font-display text-sm tracking-wider text-mundial-purple">{m.username}</span>
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      disabled={removingId === m.user_id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-mundial-red/10 text-mundial-red/50 hover:text-mundial-red transition-all disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar miembro */}
            <form onSubmit={handleAddMember} className="flex gap-2 pt-1">
              <input
                type="text"
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                placeholder="Agregar por nombre de usuario"
                required
                className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
              />
              <button
                type="submit"
                disabled={isAdding}
                className="px-4 py-2 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-60 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
              >
                {isAdding ? '…' : 'Agregar'}
              </button>
            </form>
            {memberError && <p className="text-xs text-mundial-red">{memberError}</p>}
          </div>
        </>
      )}
    </div>
  )
}
