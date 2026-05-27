'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, type Album, type AlbumMember, type AlbumSlot, type Invitation } from '@/lib/supabase'

interface Props {
  album: Album
  currentUserId: string
  canAssignAdmin: boolean
  userRole: 'admin' | 'member'
  onBack: () => void
}

type Tab = 'participants' | 'slots' | 'invitations'

export default function CampaignDetail({ album, currentUserId, canAssignAdmin, userRole, onBack }: Props) {
  const isAdminView = canAssignAdmin || userRole === 'admin'
  const [tab, setTab] = useState<Tab>('participants')

  // ── Participantes ─────────────────────────────────────────────────
  const [members, setMembers] = useState<AlbumMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [adminUsername, setAdminUsername] = useState('')
  const [memberUsername, setMemberUsername] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    const { data: rows } = await supabase
      .from('album_members')
      .select('album_id, user_id, role, added_by, created_at')
      .eq('album_id', album.id)
      .order('role', { ascending: false })
    if (!rows) { setMembersLoading(false); return }

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
        username: profiles?.find((p: { user_id: string }) => p.user_id === r.user_id)?.username ?? r.user_id.slice(0, 8),
      }))
    )
    setMembersLoading(false)
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
      const { error } = await supabase.from('album_members').upsert(
        { album_id: album.id, user_id: profile.user_id, role: 'admin', added_by: currentUserId },
        { onConflict: 'album_id,user_id' }
      )
      if (error) throw error
      setAdminUsername('')
      await fetchMembers()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Error al asignar organizador.')
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
      if (already) throw new Error(`"${memberUsername}" ya es ${already.role === 'admin' ? 'organizador' : 'participante'} de esta campaña.`)
      const { error } = await supabase.from('album_members').insert({
        album_id: album.id, user_id: profile.user_id, role: 'member', added_by: currentUserId,
      })
      if (error) throw error
      setMemberUsername('')
      await fetchMembers()
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Error al agregar participante.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId)
    await supabase.from('album_members').delete().eq('album_id', album.id).eq('user_id', userId)
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    setRemovingId(null)
  }

  // ── Slots ─────────────────────────────────────────────────────────
  const [slots, setSlots] = useState<AlbumSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsFetched, setSlotsFetched] = useState(false)
  const [newSlotNum, setNewSlotNum] = useState('')
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [isAddingSlot, setIsAddingSlot] = useState(false)
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true)
    const { data } = await supabase
      .from('album_slots')
      .select('*')
      .eq('album_id', album.id)
      .order('slot_number', { ascending: true })
    if (data) setSlots(data as AlbumSlot[])
    setSlotsLoading(false)
    setSlotsFetched(true)
  }, [album.id])

  useEffect(() => {
    if (tab === 'slots' && !slotsFetched) fetchSlots()
  }, [tab, slotsFetched, fetchSlots])

  // Sugerir el siguiente número disponible
  useEffect(() => {
    if (tab === 'slots') {
      const next = slots.length > 0 ? Math.max(...slots.map((s) => s.slot_number)) + 1 : 1
      setNewSlotNum(String(next))
    }
  }, [tab, slots])

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setSlotError(null)
    const num = parseInt(newSlotNum, 10)
    if (isNaN(num) || num < 1) { setSlotError('El número de slot debe ser mayor a 0.'); return }
    if (slots.some((s) => s.slot_number === num)) { setSlotError(`El slot ${num} ya existe.`); return }
    setIsAddingSlot(true)
    const { error } = await supabase.from('album_slots').insert({
      album_id: album.id, slot_number: num, label: newSlotLabel.trim() || null,
    })
    if (error) {
      setSlotError(error.message)
    } else {
      setNewSlotLabel('')
      await fetchSlots()
    }
    setIsAddingSlot(false)
  }

  const handleDeleteSlot = async (id: string) => {
    setDeletingSlot(id)
    await supabase.from('album_slots').delete().eq('id', id)
    setSlots((prev) => prev.filter((s) => s.id !== id))
    setDeletingSlot(null)
  }

  // ── Invitaciones ─────────────────────────────────────────────────
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invFetched, setInvFetched] = useState(false)
  const [expiryOption, setExpiryOption] = useState<'none' | '7d' | '30d'>('none')
  const [maxUsesOption, setMaxUsesOption] = useState<'none' | '10' | '50'>('none')
  const [isCreatingInv, setIsCreatingInv] = useState(false)
  const [deletingInv, setDeletingInv] = useState<string | null>(null)
  const [invError, setInvError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedQR, setExpandedQR] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    setInvLoading(true)
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('album_id', album.id)
      .order('created_at', { ascending: false })
    if (data) setInvitations(data as Invitation[])
    setInvLoading(false)
    setInvFetched(true)
  }, [album.id])

  useEffect(() => {
    if (tab === 'invitations' && !invFetched) fetchInvitations()
  }, [tab, invFetched, fetchInvitations])

  const handleCreateInvitation = async () => {
    setInvError(null)
    setIsCreatingInv(true)
    let expires_at: string | null = null
    if (expiryOption === '7d') expires_at = new Date(Date.now() + 7 * 86400000).toISOString()
    if (expiryOption === '30d') expires_at = new Date(Date.now() + 30 * 86400000).toISOString()
    const max_uses = maxUsesOption === 'none' ? null : parseInt(maxUsesOption, 10)

    const { error } = await supabase.from('invitations').insert({
      album_id: album.id,
      created_by: currentUserId,
      expires_at,
      max_uses,
    })
    if (error) {
      setInvError(error.message)
    } else {
      await fetchInvitations()
    }
    setIsCreatingInv(false)
  }

  const handleDeleteInvitation = async (id: string) => {
    setDeletingInv(id)
    await supabase.from('invitations').delete().eq('id', id)
    setInvitations((prev) => prev.filter((i) => i.id !== id))
    setDeletingInv(null)
  }

  const getJoinUrl = (token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/unirse/${token}`
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatExpiry = (iso: string | null) => {
    if (!iso) return 'Sin expiración'
    return `Expira el ${new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  const admins = members.filter((m) => m.role === 'admin')
  const regulars = members.filter((m) => m.role === 'member')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-mundial-purple/60 hover:text-mundial-purple font-condensed font-bold tracking-wider uppercase mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Campañas
        </button>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple leading-tight">
              {album.name}
            </h2>
            <div className="flex items-center gap-3 mt-0.5">
              {album.description && (
                <p className="text-sm text-mundial-purple/60">{album.description}</p>
              )}
              <span className="text-xs text-mundial-purple/40 font-condensed">
                · {album.pack_size} cromos por sobre
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-mundial-cream rounded-xl p-1 w-fit">
        {(['participants', ...(isAdminView ? ['slots', 'invitations'] : ['slots'])] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { participants: 'Participantes', slots: 'Slots', invitations: 'Invitaciones' }
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-2 rounded-lg text-xs font-condensed font-bold tracking-wider uppercase transition-all',
                tab === t
                  ? 'bg-white text-mundial-purple shadow-sm'
                  : 'text-mundial-purple/50 hover:text-mundial-purple',
              ].join(' ')}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Participantes ──────────────────────────────────────── */}
      {tab === 'participants' && (
        <div className="space-y-5">
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-mundial-cream animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Organizadores */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Organizador{admins.length !== 1 ? 'es' : ''} ({admins.length})
                </h3>
                {admins.length === 0 ? (
                  <p className="text-sm text-mundial-purple/40 italic">Sin organizador asignado.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {admins.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2 px-3 py-1.5 bg-mundial-yellow/20 border border-mundial-yellow/50 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-mundial-yellow/50 flex items-center justify-center text-[10px] font-bold text-mundial-purple">
                          {(m.username ?? '?')[0].toUpperCase()}
                        </div>
                        <span className="font-display text-sm tracking-wider text-mundial-purple">{m.username}</span>
                        <span className="text-[9px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-yellow-dark bg-mundial-yellow/40 px-1.5 py-0.5 rounded-full">
                          Org
                        </span>
                        {isAdminView && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={removingId === m.user_id}
                            className="text-mundial-purple/30 hover:text-mundial-red transition-colors ml-1 disabled:opacity-40"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
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

              {/* Participantes */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Participantes ({regulars.length})
                </h3>
                {regulars.length === 0 ? (
                  <p className="text-sm text-mundial-purple/40 italic">Sin participantes todavía.</p>
                ) : (
                  <div className="grid gap-2">
                    {regulars.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-white/60 rounded-xl group">
                        <div className="w-8 h-8 rounded-full bg-mundial-purple/10 flex items-center justify-center text-sm font-bold text-mundial-purple">
                          {(m.username ?? '?')[0].toUpperCase()}
                        </div>
                        <span className="flex-1 font-display text-sm tracking-wider text-mundial-purple">{m.username}</span>
                        {isAdminView && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={removingId === m.user_id}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-mundial-red/10 text-mundial-red/50 hover:text-mundial-red transition-all disabled:opacity-40"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {isAdminView && (
                  <>
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
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Slots ─────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="flex items-center gap-3 px-5 py-3 bg-mundial-yellow/10 border border-mundial-yellow/30 rounded-2xl">
            <svg className="w-5 h-5 text-mundial-yellow-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {slots.length} slot{slots.length !== 1 ? 's' : ''} definido{slots.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-mundial-purple/50">— cada participante tendrá que llenar estos espacios en su álbum</span>
          </div>

          {/* Formulario (solo admin) */}
          {isAdminView && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                Agregar slot
              </h3>
              <form onSubmit={handleAddSlot} className="flex gap-2 flex-wrap">
                <input
                  type="number"
                  min={1}
                  value={newSlotNum}
                  onChange={(e) => setNewSlotNum(e.target.value)}
                  placeholder="Nº"
                  required
                  className="w-20 px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                />
                <input
                  type="text"
                  value={newSlotLabel}
                  onChange={(e) => setNewSlotLabel(e.target.value)}
                  placeholder="Etiqueta opcional (ej: Portero, Defensa...)"
                  className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isAddingSlot}
                  className="px-4 py-2 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-60 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                >
                  {isAddingSlot ? '…' : 'Agregar'}
                </button>
              </form>
              {slotError && <p className="text-xs text-mundial-red">{slotError}</p>}
            </div>
          )}

          {/* Lista de slots */}
          {slotsLoading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-mundial-cream animate-pulse" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
              <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin slots definidos</p>
              {isAdminView && (
                <p className="text-sm text-mundial-purple/35">Usá el formulario de arriba para crear los slots del álbum.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 px-4 py-3 bg-white/70 rounded-xl border border-mundial-purple/10 group">
                  <div className="w-9 h-9 rounded-lg bg-mundial-purple/10 flex items-center justify-center shrink-0">
                    <span className="font-display text-sm text-mundial-purple font-bold">{slot.slot_number}</span>
                  </div>
                  <span className="flex-1 text-sm text-mundial-purple">
                    {slot.label ?? <span className="text-mundial-purple/35 italic">Sin etiqueta</span>}
                  </span>
                  {isAdminView && (
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      disabled={deletingSlot === slot.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-mundial-red/10 text-mundial-red/50 hover:text-mundial-red transition-all disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Invitaciones ──────────────────────────────────────── */}
      {tab === 'invitations' && isAdminView && (
        <div className="space-y-5">
          {/* Crear invitación */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
              Nueva invitación
            </h3>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <label className="block font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/50">
                  Expiración
                </label>
                <select
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value as 'none' | '7d' | '30d')}
                  className="px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple focus:outline-none focus:border-mundial-purple/50 transition-colors"
                >
                  <option value="none">Sin expiración</option>
                  <option value="7d">7 días</option>
                  <option value="30d">30 días</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/50">
                  Límite de usos
                </label>
                <select
                  value={maxUsesOption}
                  onChange={(e) => setMaxUsesOption(e.target.value as 'none' | '10' | '50')}
                  className="px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple focus:outline-none focus:border-mundial-purple/50 transition-colors"
                >
                  <option value="none">Ilimitado</option>
                  <option value="10">10 usos</option>
                  <option value="50">50 usos</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleCreateInvitation}
              disabled={isCreatingInv}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-60 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
            >
              {isCreatingInv ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              )}
              Generar enlace
            </button>
            {invError && <p className="text-xs text-mundial-red">{invError}</p>}
          </div>

          {/* Lista de invitaciones */}
          {invLoading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-mundial-cream animate-pulse" />)}
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
              <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin invitaciones activas</p>
              <p className="text-sm text-mundial-purple/35">Generá un enlace arriba para invitar participantes.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {invitations.map((inv) => {
                const url = getJoinUrl(inv.token)
                const isExpired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false
                const isExhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses
                const isInactive = isExpired || isExhausted
                return (
                  <div
                    key={inv.id}
                    className={[
                      'glass-card rounded-2xl p-5 space-y-3',
                      isInactive ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* URL */}
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-mundial-purple/70 bg-mundial-cream px-2 py-1 rounded-lg truncate max-w-xs block">
                            {url}
                          </code>
                          <button
                            onClick={() => copyToClipboard(url, inv.id)}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-mundial-purple/10 text-mundial-purple/50 hover:text-mundial-purple transition-colors"
                            title="Copiar enlace"
                          >
                            {copiedId === inv.id ? (
                              <svg className="w-4 h-4 text-mundial-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-mundial-purple/50">
                          <span>{inv.uses_count} uso{inv.uses_count !== 1 ? 's' : ''}{inv.max_uses !== null ? ` / ${inv.max_uses}` : ''}</span>
                          <span>·</span>
                          <span>{formatExpiry(inv.expires_at)}</span>
                          {isExpired && <span className="text-mundial-red font-bold">EXPIRADA</span>}
                          {isExhausted && !isExpired && <span className="text-mundial-red font-bold">AGOTADA</span>}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedQR(expandedQR === inv.id ? null : inv.id)}
                          className="p-2 rounded-lg hover:bg-mundial-purple/10 text-mundial-purple/50 hover:text-mundial-purple transition-colors"
                          title="Ver QR"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteInvitation(inv.id)}
                          disabled={deletingInv === inv.id}
                          className="p-2 rounded-lg hover:bg-mundial-red/10 text-mundial-red/40 hover:text-mundial-red transition-colors disabled:opacity-40"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* QR expandido */}
                    {expandedQR === inv.id && (
                      <div className="pt-2 flex flex-col items-center gap-3 border-t border-mundial-purple/10">
                        <div className="bg-white p-3 rounded-xl shadow-sm">
                          <QRCodeSVG value={url} size={160} />
                        </div>
                        <p className="text-xs text-mundial-purple/50 font-condensed text-center">
                          Escanear para unirse a la campaña
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
