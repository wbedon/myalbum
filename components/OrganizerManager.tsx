'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album } from '@/lib/supabase'

interface OrganizerEntry {
  user_id: string
  username: string
  email: string
  created_at: string
  campaigns: { id: string; name: string }[]
}

export default function OrganizerManager() {
  const [organizers, setOrganizers] = useState<OrganizerEntry[]>([])
  const [campaigns, setCampaigns] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  // ── Invite form ───────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // ── Remove ────────────────────────────────────────────────────
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchOrganizers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/organizers')
    if (res.ok) setOrganizers(await res.json())
    setLoading(false)
  }, [])

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase.from('albums').select('*').order('created_at', { ascending: false })
    if (data) setCampaigns(data as Album[])
  }, [])

  useEffect(() => {
    fetchOrganizers()
    fetchCampaigns()
  }, [fetchOrganizers, fetchCampaigns])

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
      body: JSON.stringify({ email: inviteEmail.trim(), campaignIds: selectedCampaigns }),
    })

    const data = await res.json()
    if (!res.ok) {
      setInviteError(data.error ?? 'Error al enviar la invitación')
    } else {
      setInviteSuccess(`Invitación enviada a ${inviteEmail.trim()}`)
      setInviteEmail('')
      setSelectedCampaigns([])
      await fetchOrganizers()
    }
    setInviting(false)
  }

  const handleRemove = async (org: OrganizerEntry) => {
    setRemovingId(org.user_id)
    await fetch('/api/organizers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: org.user_id }),
    })
    setOrganizers(prev => prev.filter(o => o.user_id !== org.user_id))
    setRemovingId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
          Organizadores
        </h2>
      </div>

      {/* Invite form */}
      <div className="glass-card rounded-2xl p-6 border-2 border-mundial-yellow/40 space-y-4">
        <h3 className="font-display text-sm tracking-wider uppercase text-mundial-purple/70">Invitar organizador</h3>
        <form onSubmit={handleInvite} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email del organizador"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
          />

          {/* Campaign selection */}
          {campaigns.length > 0 && (
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

      {/* Organizers list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : organizers.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
          <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin organizadores</p>
          <p className="text-sm text-mundial-purple/35">Invitá el primero con el formulario de arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            {organizers.length} organizador{organizers.length !== 1 ? 'es' : ''}
          </p>
          {organizers.map(org => (
            <div key={org.user_id} className="glass-card rounded-2xl p-5 flex items-start gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-mundial-purple flex items-center justify-center shrink-0">
                <span className="font-display text-base text-white uppercase">
                  {(org.username ?? org.email)[0]}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">
                  {org.username}
                </p>
                <p className="text-xs text-mundial-purple/50">{org.email}</p>
                {org.campaigns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {org.campaigns.map(c => (
                      <span key={c.id} className="px-2 py-0.5 rounded-full bg-mundial-yellow/30 text-mundial-purple text-[10px] font-condensed font-bold tracking-wider uppercase">
                        {c.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-mundial-purple/30 font-condensed uppercase tracking-wider">Sin campañas asignadas</p>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={() => handleRemove(org)}
                disabled={removingId === org.user_id}
                className="shrink-0 px-3 py-1.5 text-xs font-display tracking-wider uppercase bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                {removingId === org.user_id ? '…' : 'Quitar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
