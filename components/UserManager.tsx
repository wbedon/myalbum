'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album } from '@/lib/supabase'

interface UserEntry {
  user_id: string
  username: string
  email: string
  role: 'user' | 'superadmin' | 'organizer'
  must_change_password: boolean
  created_at: string
  last_sign_in_at: string | null
}

interface Props {
  currentUserId: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  organizer:  'Organizador',
  user:       'Usuario',
}

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-mundial-purple text-white',
  organizer:  'bg-mundial-yellow/30 text-mundial-purple',
  user:       'bg-mundial-green/20 text-mundial-green',
}

export default function UserManager({ currentUserId }: Props) {
  const [users, setUsers] = useState<UserEntry[]>([])
  const [campaigns, setCampaigns] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'organizer' | 'user'>('organizer')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Actions
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase.from('albums').select('*').order('created_at', { ascending: false })
    if (data) setCampaigns(data as Album[])
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchCampaigns()
  }, [fetchUsers, fetchCampaigns])

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:       inviteEmail.trim(),
        role:        inviteRole,
        campaignIds: inviteRole === 'organizer' ? selectedCampaigns : [],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error ?? 'Error al enviar la invitación')
    } else {
      setInviteSuccess(`Invitación enviada a ${inviteEmail.trim()}`)
      setInviteEmail('')
      setSelectedCampaigns([])
      await fetchUsers()
    }
    setInviting(false)
  }

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: role as UserEntry['role'] } : u))
    setUpdatingId(null)
  }

  const handleForcePassword = async (userId: string) => {
    setUpdatingId(userId)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, must_change_password: true }),
    })
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, must_change_password: true } : u))
    setUpdatingId(null)
  }

  const handleDelete = async (userId: string) => {
    setDeletingId(userId)
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setUsers(prev => prev.filter(u => u.user_id !== userId))
    setConfirmDeleteId(null)
    setDeletingId(null)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Nunca'
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
          Usuarios
        </h2>
      </div>

      {/* Invite form */}
      <div className="glass-card rounded-2xl p-6 border-2 border-mundial-yellow/40 space-y-4">
        <h3 className="font-display text-sm tracking-wider uppercase text-mundial-purple/70">Invitar usuario</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input
              type="email"
              required
              placeholder="Email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
            />
            <select
              value={inviteRole}
              onChange={e => { setInviteRole(e.target.value as 'organizer' | 'user'); setSelectedCampaigns([]) }}
              className="px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple text-sm focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
            >
              <option value="organizer">Organizador</option>
              <option value="user">Usuario</option>
            </select>
          </div>

          {inviteRole === 'organizer' && campaigns.length > 0 && (
            <div className="space-y-2">
              <p className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-mundial-purple/50">
                Asignar a campañas (opcional)
              </p>
              <div className="flex flex-wrap gap-2">
                {campaigns.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCampaign(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-display tracking-wider uppercase transition-colors ${
                      selectedCampaigns.includes(c.id)
                        ? 'bg-mundial-green text-white'
                        : 'bg-mundial-purple/10 text-mundial-purple hover:bg-mundial-purple/20'
                    }`}
                  >
                    {selectedCampaigns.includes(c.id) && '✓ '}{c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-display text-sm tracking-wider uppercase transition-colors bg-mundial-purple text-white hover:bg-mundial-purple/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {inviting ? 'Enviando…' : 'Enviar invitación'}
          </button>

          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-sm text-mundial-green bg-mundial-green/10 border border-mundial-green/30 rounded-xl px-4 py-2">{inviteSuccess}</p>
          )}
        </form>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
          <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin usuarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            {users.length} usuario{users.length !== 1 ? 's' : ''}
          </p>
          {users.map(user => {
            const isSelf = user.user_id === currentUserId
            const isSuperadmin = user.role === 'superadmin'

            return (
              <div key={user.user_id} className="glass-card rounded-2xl p-5 flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-mundial-purple flex items-center justify-center shrink-0">
                  <span className="font-display text-base text-white uppercase">
                    {(user.username ?? user.email)[0]}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">
                      {user.username}
                    </p>
                    {isSelf && (
                      <span className="px-2 py-0.5 rounded-full bg-mundial-yellow/40 text-mundial-purple text-[9px] font-condensed font-bold tracking-wider uppercase">
                        Tú
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-condensed font-bold tracking-wider uppercase ${ROLE_BADGE[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.must_change_password && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-condensed font-bold tracking-wider uppercase">
                        Cambio pw pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-mundial-purple/50">{user.email}</p>
                  <p className="text-[10px] text-mundial-purple/35">
                    Último acceso: {formatDate(user.last_sign_in_at)}
                  </p>
                </div>

                {/* Actions — not shown for self */}
                {!isSelf && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Role selector — not for superadmin */}
                    {!isSuperadmin && (
                      <select
                        value={user.role}
                        disabled={updatingId === user.user_id}
                        onChange={e => handleRoleChange(user.user_id, e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-mundial-purple/20 bg-white text-mundial-purple text-xs focus:outline-none focus:border-mundial-green transition-colors disabled:opacity-50"
                      >
                        <option value="user">Usuario</option>
                        <option value="organizer">Organizador</option>
                      </select>
                    )}

                    {/* Force password change */}
                    {!user.must_change_password && (
                      <button
                        onClick={() => handleForcePassword(user.user_id)}
                        disabled={updatingId === user.user_id}
                        title="Forzar cambio de contraseña"
                        className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-600 transition-colors disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </button>
                    )}

                    {/* Delete */}
                    {confirmDeleteId === user.user_id ? (
                      <>
                        <button
                          onClick={() => handleDelete(user.user_id)}
                          disabled={deletingId === user.user_id}
                          className="px-3 py-1.5 bg-mundial-red text-white text-xs font-display tracking-wider uppercase rounded-lg disabled:opacity-60"
                        >
                          {deletingId === user.user_id ? '…' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 bg-mundial-cream text-mundial-purple text-xs font-display tracking-wider uppercase rounded-lg"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(user.user_id)}
                        className="p-1.5 rounded-lg hover:bg-mundial-red/10 text-mundial-red/50 hover:text-mundial-red transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
