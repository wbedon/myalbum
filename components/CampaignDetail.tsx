'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, type Album, type AlbumMember, type AlbumSlot, type Invitation, type Sticker, type CoverEdition } from '@/lib/supabase'
import StickerEditor from './StickerEditor'
import AlbumView from './AlbumView'
import TradeView from './TradeView'
import GalleryView from './GalleryView'
import NotificationsPanel, { type TabBadgeCounts } from './NotificationsPanel'
import Avatar from './Avatar'
import UserProfileModal from './UserProfileModal'

interface Props {
  album: Album
  currentUserId: string
  canAssignAdmin: boolean
  userRole: 'admin' | 'member'
  onBack: () => void
}

type Tab = 'participants' | 'slots' | 'invitations' | 'stickers' | 'review' | 'album' | 'gallery' | 'trades' | 'stats'

interface PendingStickerMeta extends Sticker {
  username?: string
  slotNumber?: number
  slotLabel?: string | null
}

export default function CampaignDetail({ album, currentUserId, canAssignAdmin, userRole, onBack }: Props) {
  const isAdminView = canAssignAdmin || userRole === 'admin'
  const [tab, setTab] = useState<Tab>(isAdminView ? 'participants' : 'album')

  // ── Notificaciones ────────────────────────────────────────────────
  const [tabBadges, setTabBadges] = useState<TabBadgeCounts>({ stickers: 0, album: 0, trades: 0 })
  const [notifRefreshKey, setNotifRefreshKey] = useState(0)

  // ── Editar álbum ─────────────────────────────────────────────────
  const [albumDisplay, setAlbumDisplay] = useState({
    name: album.name, description: album.description, pack_size: album.pack_size,
    cover_edition_id: album.cover_edition_id ?? null,
  })
  const [editAlbumOpen, setEditAlbumOpen] = useState(false)
  const [editName, setEditName]           = useState(album.name)
  const [editDesc, setEditDesc]           = useState(album.description ?? '')
  const [editPackSize, setEditPackSize]   = useState(album.pack_size)
  const [editEditionId, setEditEditionId] = useState<string | null>(album.cover_edition_id ?? null)
  const [isSavingAlbum, setIsSavingAlbum] = useState(false)
  const [albumSaveError, setAlbumSaveError] = useState<string | null>(null)
  const [coverEditions, setCoverEditions] = useState<CoverEdition[]>([])
  const [coverEditionsFetched, setCoverEditionsFetched] = useState(false)

  const openEditAlbum = () => {
    setEditName(albumDisplay.name)
    setEditDesc(albumDisplay.description ?? '')
    setEditPackSize(albumDisplay.pack_size)
    setEditEditionId(albumDisplay.cover_edition_id)
    setAlbumSaveError(null)
    setEditAlbumOpen(true)
  }

  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAlbum(true)
    setAlbumSaveError(null)
    const ps = Math.max(1, Math.min(50, editPackSize))
    const { error } = await supabase
      .from('albums')
      .update({
        name: editName.trim(),
        description: editDesc.trim() || null,
        pack_size: ps,
        cover_edition_id: editEditionId,
      })
      .eq('id', album.id)
    if (error) {
      setAlbumSaveError(error.message)
    } else {
      setAlbumDisplay({
        name: editName.trim(),
        description: editDesc.trim() || null,
        pack_size: ps,
        cover_edition_id: editEditionId,
      })
      setEditAlbumOpen(false)
    }
    setIsSavingAlbum(false)
  }

  useEffect(() => {
    if (!editAlbumOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditAlbumOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editAlbumOpen])

  useEffect(() => {
    if (!editAlbumOpen || coverEditionsFetched) return
    supabase.from('cover_editions').select('*').order('sort_order').then(({ data }: { data: CoverEdition[] | null }) => {
      if (data) setCoverEditions(data)
      setCoverEditionsFetched(true)
    })
  }, [editAlbumOpen, coverEditionsFetched])

  // ── Compartir (vista pública) ─────────────────────────────────────
  const [isPublic, setIsPublic]   = useState(album.is_public ?? false)
  const [shareOpen, setShareOpen] = useState(false)
  const [toggling, setToggling]   = useState(false)
  const [copied, setCopied]       = useState(false)
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/album/${album.id}` : ''

  const handleTogglePublic = async () => {
    setToggling(true)
    const next = !isPublic
    const { error } = await supabase
      .from('albums')
      .update({ is_public: next })
      .eq('id', album.id)
    if (!error) setIsPublic(next)
    setToggling(false)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Close share panel on outside click
  useEffect(() => {
    if (!shareOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-share-panel]')) setShareOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shareOpen])

  // ── Estadísticas (admin) ──────────────────────────────────────────
  interface AlbumStats {
    stickers_by_status: Record<string, number>
    total_members: number
    total_slots: number
    slots_covered: number
    recent_activity: Array<{
      id: string; status: string; updated_at: string
      username: string; slot_number: number; slot_label: string | null
    }>
    top_reactors: Array<{ username: string; reaction_count: number }>
    reactions_by_emoji: Record<string, number>
  }
  const [stats, setStats] = useState<AlbumStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsFetched, setStatsFetched] = useState(false)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    const result = await supabase.rpc('get_album_stats', { p_album_id: album.id })
    if (!result.error && result.data) setStats(result.data as AlbumStats)
    setStatsFetched(true)
    setStatsLoading(false)
  }, [album.id])

  // ── Perfil de usuario ─────────────────────────────────────────────
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

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
  const [slotError, setSlotError]     = useState<string | null>(null)
  const [bulkRange, setBulkRange]     = useState('')
  const [isBulking, setIsBulking]     = useState(false)
  const [bulkError, setBulkError]     = useState<string | null>(null)
  const [bulkResult, setBulkResult]   = useState<string | null>(null)

  const handleBulkSlots = async (e: React.FormEvent) => {
    e.preventDefault()
    setBulkError(null)
    setBulkResult(null)
    setIsBulking(true)

    const trimmed = bulkRange.trim()
    let from: number, to: number

    if (/^\d+-\d+$/.test(trimmed)) {
      const parts = trimmed.split('-').map(Number)
      from = parts[0]; to = parts[1]
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10)
      from = slots.length > 0 ? Math.max(...slots.map((s) => s.slot_number)) + 1 : 1
      to = from + n - 1
    } else {
      setBulkError('Formato inválido. Usá un número (ej: 22) o un rango (ej: 1-22).')
      setIsBulking(false)
      return
    }

    if (from < 1 || to < from || (to - from) > 499) {
      setBulkError('Rango inválido (máximo 500 slots por operación).')
      setIsBulking(false)
      return
    }

    const existingNums = new Set(slots.map((s) => s.slot_number))
    const toInsert = []
    for (let n = from; n <= to; n++) {
      if (!existingNums.has(n)) toInsert.push({ album_id: album.id, slot_number: n, label: null })
    }

    if (toInsert.length === 0) {
      setBulkResult('Todos los slots en ese rango ya existen.')
      setIsBulking(false)
      return
    }

    const { data, error } = await supabase.from('album_slots').insert(toInsert).select()
    if (error) {
      setBulkError(error.message)
    } else {
      setSlots((prev) =>
        [...prev, ...(data as AlbumSlot[])].sort((a, b) => a.slot_number - b.slot_number)
      )
      setBulkResult(`${toInsert.length} slot${toInsert.length !== 1 ? 's' : ''} creado${toInsert.length !== 1 ? 's' : ''}.`)
      setBulkRange('')
    }
    setIsBulking(false)
  }

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
    if ((tab === 'slots' || tab === 'album' || tab === 'participants' || tab === 'stickers') && !slotsFetched) fetchSlots()
    if (tab === 'stats' && !statsFetched) fetchStats()
  }, [tab, slotsFetched, fetchSlots, statsFetched, fetchStats])

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

  // ── Asignación de slots ──────────────────────────────────────────
  const [assigningSlotFor, setAssigningSlotFor] = useState<string | null>(null)

  const handleAssignSlot = useCallback(async (memberId: string, slotId: string | null) => {
    setAssigningSlotFor(memberId)
    // Liberar asignación previa de este usuario en el álbum
    await supabase
      .from('album_slots')
      .update({ assigned_user_id: null })
      .eq('album_id', album.id)
      .eq('assigned_user_id', memberId)
    // Asignar el nuevo slot si se seleccionó uno
    if (slotId) {
      await supabase
        .from('album_slots')
        .update({ assigned_user_id: memberId })
        .eq('id', slotId)
    }
    await fetchSlots()
    setAssigningSlotFor(null)
  }, [album.id, fetchSlots])

  const handleDeleteMySticker = useCallback(async (stickerId: string) => {
    setDeletingSticker(true)
    await supabase.from('stickers').delete().eq('id', stickerId)
    setMyStickers([])
    setMyStickersFetched(false)
    setConfirmDeleteSticker(false)
    setDeletingSticker(false)
  }, [])

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
  const [inviteEmail, setInviteEmail] = useState('')
  const [isSendingInvEmail, setIsSendingInvEmail] = useState(false)
  const [invEmailMsg, setInvEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [expandedQR, setExpandedQR] = useState<string | null>(null)

  // ── Mis Cromos ────────────────────────────────────────────────────
  const [myStickers, setMyStickers] = useState<Sticker[]>([])
  const [myStickersFetched, setMyStickersFetched] = useState(false)
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<AlbumSlot | null>(null)
  const [deletingSticker, setDeletingSticker] = useState(false)
  const [confirmDeleteSticker, setConfirmDeleteSticker] = useState(false)

  // ── Revisión (admin) ──────────────────────────────────────────────
  const [pendingStickers, setPendingStickers] = useState<PendingStickerMeta[]>([])
  const [pendingFetched, setPendingFetched] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

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

  const fetchMyStickers = useCallback(async () => {
    const { data } = await supabase
      .from('stickers')
      .select('*')
      .eq('album_id', album.id)
      .eq('user_id', currentUserId)
    if (data) setMyStickers(data as Sticker[])
    setMyStickersFetched(true)
  }, [album.id, currentUserId])

  const fetchPendingStickers = useCallback(async () => {
    const { data } = await supabase
      .from('stickers')
      .select('*')
      .eq('album_id', album.id)
      .eq('status', 'pending')
    if (!data || data.length === 0) { setPendingStickers([]); setPendingFetched(true); return }
    const userIds = Array.from(new Set((data as Sticker[]).map((s) => s.user_id)))
    const slotIds = Array.from(new Set((data as Sticker[]).map((s) => s.slot_id)))
    const [{ data: profiles }, { data: slotsData }] = await Promise.all([
      supabase.from('profiles').select('user_id, username').in('user_id', userIds),
      supabase.from('album_slots').select('id, slot_number, label').in('id', slotIds),
    ])
    setPendingStickers(
      (data as Sticker[]).map((s) => ({
        ...s,
        username: (profiles as { user_id: string; username: string | null }[] | null)?.find((p) => p.user_id === s.user_id)?.username ?? s.user_id.slice(0, 8),
        slotNumber: (slotsData as { id: string; slot_number: number; label: string | null }[] | null)?.find((sl) => sl.id === s.slot_id)?.slot_number,
        slotLabel: (slotsData as { id: string; slot_number: number; label: string | null }[] | null)?.find((sl) => sl.id === s.slot_id)?.label ?? null,
      }))
    )
    setPendingFetched(true)
  }, [album.id])

  useEffect(() => {
    if ((tab === 'stickers') && !myStickersFetched) fetchMyStickers()
  }, [tab, myStickersFetched, fetchMyStickers])

  useEffect(() => {
    if ((tab === 'stickers' || tab === 'review' || tab === 'gallery' || tab === 'trades' || tab === 'album') && !slotsFetched) fetchSlots()
  }, [tab, slotsFetched, fetchSlots])

  useEffect(() => {
    if (tab === 'review' && !pendingFetched) fetchPendingStickers()
  }, [tab, pendingFetched, fetchPendingStickers])

  const handleApprove = async (stickerId: string) => {
    setIsReviewing(true)
    const { error } = await supabase.from('stickers').update({ status: 'approved' }).eq('id', stickerId)
    if (!error) setPendingStickers((prev) => prev.filter((s) => s.id !== stickerId))
    setIsReviewing(false)
  }

  const handleReject = async (stickerId: string) => {
    if (!rejectReason.trim()) return
    setIsReviewing(true)
    const { error } = await supabase
      .from('stickers')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
      .eq('id', stickerId)
    if (!error) {
      setPendingStickers((prev) => prev.filter((s) => s.id !== stickerId))
      setRejectingId(null)
      setRejectReason('')
    }
    setIsReviewing(false)
  }

  const handleStickerSaved = useCallback((sticker: Sticker) => {
    setMyStickers((prev) => {
      const idx = prev.findIndex((s) => s.slot_id === sticker.slot_id)
      if (idx >= 0) { const next = [...prev]; next[idx] = sticker; return next }
      return [...prev, sticker]
    })
    setSelectedSlotForEditor(null)
  }, [])

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

  const handleSendInviteEmail = async () => {
    if (!inviteEmail.trim()) return
    setIsSendingInvEmail(true)
    setInvEmailMsg(null)

    // Crear una invitación de 1 uso para este email
    const { data: inv, error: invErr } = await supabase
      .from('invitations')
      .insert({ album_id: album.id, created_by: currentUserId, max_uses: 1 })
      .select()
      .single()

    if (invErr || !inv) {
      setInvEmailMsg({ ok: false, text: 'No se pudo generar el enlace.' })
      setIsSendingInvEmail(false)
      return
    }

    await fetchInvitations()

    const joinUrl = getJoinUrl(inv.token)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/campaigns/invite-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        email:        inviteEmail.trim(),
        albumId:      album.id,
        joinUrl,
        campaignName: album.name,
      }),
    })

    const body = await res.json()
    if (res.ok) {
      setInvEmailMsg({ ok: true, text: `Invitación enviada a ${inviteEmail.trim()}` })
      setInviteEmail('')
    } else {
      setInvEmailMsg({ ok: false, text: body.error ?? 'Error al enviar.' })
    }
    setIsSendingInvEmail(false)
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

  // Auto-mark notifications as read when switching to the relevant tab
  useEffect(() => {
    const typesForTab: Partial<Record<Tab, string[]>> = {
      stickers: ['sticker_approved', 'sticker_rejected'],
      album:    ['pack_available'],
      trades:   ['trade_requested', 'trade_accepted'],
    }
    const types = typesForTab[tab]
    if (!types) return
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('album_id', album.id)
      .in('type', types)
      .eq('read', false)
      .then(() => setNotifRefreshKey((k) => k + 1))
  }, [tab, album.id])

  const admins = members.filter((m) => m.role === 'admin')
  const regulars = members.filter((m) => m.role === 'member')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          aria-label="Volver a campañas"
          className="inline-flex items-center gap-1.5 text-sm text-mundial-purple/60 hover:text-mundial-purple font-condensed font-bold tracking-wider uppercase mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Campañas
        </button>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple leading-tight">
              {albumDisplay.name}
            </h2>
            <div className="flex items-center gap-3 mt-0.5">
              {albumDisplay.description && (
                <p className="text-sm text-mundial-purple/60">{albumDisplay.description}</p>
              )}
              <span className="text-xs text-mundial-purple/40 font-condensed">
                · {albumDisplay.pack_size} cromos por sobre
              </span>
            </div>
          </div>
          <NotificationsPanel
            albumId={album.id}
            refreshKey={notifRefreshKey}
            onTabBadge={setTabBadges}
          />
          {/* Edit album button — admin only */}
          {isAdminView && (
            <button
              onClick={openEditAlbum}
              title="Editar álbum"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-mundial-cream hover:bg-mundial-purple/8 text-mundial-purple/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
          )}
          {/* Share button — admin only */}
          {isAdminView && (
            <div className="relative" data-share-panel>
              <button
                onClick={() => setShareOpen((o) => !o)}
                title={isPublic ? 'Álbum público' : 'Compartir álbum'}
                className={[
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                  isPublic
                    ? 'bg-mundial-green/15 text-mundial-green border border-mundial-green/30'
                    : 'bg-mundial-cream hover:bg-mundial-purple/8 text-mundial-purple/50',
                ].join(' ')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>

              {shareOpen && (
                <div className="absolute right-0 top-12 z-30 w-80 glass-card rounded-2xl shadow-xl border border-mundial-purple/10 p-4 space-y-4 animate-fade-in">
                  {/* Status toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-sm tracking-wider uppercase text-mundial-purple">
                        Vista pública
                      </p>
                      <p className="text-xs text-mundial-purple/50 mt-0.5">
                        {isPublic
                          ? 'Cualquiera con el link puede ver este álbum'
                          : 'Solo los participantes pueden ver este álbum'}
                      </p>
                    </div>
                    <button
                      onClick={handleTogglePublic}
                      disabled={toggling}
                      className={[
                        'relative w-11 h-6 rounded-full transition-colors shrink-0',
                        isPublic ? 'bg-mundial-green' : 'bg-mundial-purple/20',
                        toggling ? 'opacity-50' : '',
                      ].join(' ')}
                    >
                      <span className={[
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        isPublic ? 'translate-x-5' : 'translate-x-0.5',
                      ].join(' ')} />
                    </button>
                  </div>

                  {/* Public URL */}
                  {isPublic && (
                    <div className="space-y-2">
                      <p className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/40">
                        Link público
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={publicUrl}
                          className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg bg-mundial-cream border border-mundial-purple/15 text-mundial-purple/70 font-mono truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className={[
                            'shrink-0 px-3 py-2 rounded-lg text-xs font-condensed font-bold tracking-wider uppercase transition-colors',
                            copied
                              ? 'bg-mundial-green text-white'
                              : 'bg-mundial-purple text-white hover:bg-mundial-purple/90',
                          ].join(' ')}
                        >
                          {copied ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-mundial-cream rounded-xl p-1 w-fit">
        {(isAdminView
          ? ['participants', 'slots', 'invitations', 'stickers', 'review', 'album', 'gallery', 'trades', 'stats'] as Tab[]
          : ['album', 'stickers'] as Tab[]
        ).map((t) => {
          const labels: Record<Tab, string> = {
            participants: 'Participantes', slots: 'Slots', invitations: 'Invitaciones',
            stickers: isAdminView ? 'Mis Cromos' : 'Mi Sticker', review: 'Revisión', album: 'Mi Álbum',
            gallery: 'Galería', trades: 'Intercambios', stats: 'Stats',
          }
          const badgeCount =
            t === 'stickers' ? tabBadges.stickers :
            t === 'album'    ? tabBadges.album    :
            t === 'trades'   ? tabBadges.trades   : 0
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'relative px-4 py-2 rounded-lg text-xs font-condensed font-bold tracking-wider uppercase transition-all',
                tab === t
                  ? 'bg-white text-mundial-purple shadow-sm'
                  : 'text-mundial-purple/50 hover:text-mundial-purple',
              ].join(' ')}
            >
              {labels[t]}
              {badgeCount > 0 && tab !== t && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
              )}
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
                        <button
                          onClick={() => setProfileUserId(m.user_id)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          <Avatar username={m.username ?? '?'} size="xs" />
                          <span className="font-display text-sm tracking-wider text-mundial-purple">{m.username}</span>
                        </button>
                        <span className="text-[9px] font-condensed font-bold tracking-[0.2em] uppercase text-mundial-yellow-dark bg-mundial-yellow/40 px-1.5 py-0.5 rounded-full">
                          Org
                        </span>
                        {isAdminView && m.user_id !== currentUserId && (
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
                    {regulars.map((m) => {
                      const assignedSlot = slots.find(s => s.assigned_user_id === m.user_id) ?? null
                      const freeSlots = slots.filter(s => !s.assigned_user_id || s.assigned_user_id === m.user_id)
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-white/60 rounded-xl group">
                          <button
                            onClick={() => setProfileUserId(m.user_id)}
                            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                          >
                            <Avatar username={m.username ?? '?'} size="sm" />
                            <span className="font-display text-sm tracking-wider text-mundial-purple truncate">{m.username}</span>
                          </button>
                          {/* Selector de slot */}
                          {isAdminView && slotsFetched && slots.length > 0 && (
                            <select
                              value={assignedSlot?.id ?? ''}
                              onChange={(e) => handleAssignSlot(m.user_id, e.target.value || null)}
                              disabled={assigningSlotFor === m.user_id}
                              className="text-[11px] font-condensed font-bold rounded-lg border border-mundial-purple/20 bg-white/80 px-2 py-1 text-mundial-purple focus:outline-none focus:border-mundial-yellow disabled:opacity-50 max-w-[110px]"
                            >
                              <option value="">Sin slot</option>
                              {freeSlots.map(s => (
                                <option key={s.id} value={s.id}>
                                  #{s.slot_number}{s.label ? ` · ${s.label}` : ''}
                                </option>
                              ))}
                            </select>
                          )}
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
                      )
                    })}
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

              {/* Creación masiva */}
              <div className="border-t border-mundial-purple/10 pt-3 space-y-2">
                <p className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/40">
                  Creación masiva
                </p>
                <form onSubmit={handleBulkSlots} className="flex gap-2 flex-wrap items-center">
                  <input
                    type="text"
                    value={bulkRange}
                    onChange={(e) => { setBulkRange(e.target.value); setBulkError(null); setBulkResult(null) }}
                    placeholder='Ej: "1-22" o "10" (agrega 10 slots)'
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-yellow focus:ring-2 focus:ring-mundial-yellow/20 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isBulking || !bulkRange.trim()}
                    className="px-4 py-2 bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-60 text-mundial-purple font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                  >
                    {isBulking ? '…' : 'Crear'}
                  </button>
                </form>
                {bulkError && <p className="text-xs text-mundial-red">{bulkError}</p>}
                {bulkResult && <p className="text-xs text-mundial-green font-bold">{bulkResult}</p>}
              </div>
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

      {/* ── Tab: Mis Cromos ───────────────────────────────────────── */}
      {tab === 'stickers' && (
        <div className="space-y-5">
          {selectedSlotForEditor ? (
            <StickerEditor
              albumId={album.id}
              slot={selectedSlotForEditor}
              currentUserId={currentUserId}
              existingSticker={myStickers.find((s) => s.slot_id === selectedSlotForEditor.id) ?? null}
              onSave={handleStickerSaved}
              onClose={() => setSelectedSlotForEditor(null)}
            />
          ) : isAdminView ? (
            /* ── Vista admin: grilla completa de slots ── */
            (() => {
              const mySticker = myStickers[0] ?? null
              const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
                draft:    { label: 'Borrador',    dot: 'bg-mundial-yellow-dark', bg: 'bg-mundial-yellow/10 border-mundial-yellow/30' },
                pending:  { label: 'En revisión', dot: 'bg-mundial-purple',      bg: 'bg-mundial-purple/10 border-mundial-purple/20' },
                approved: { label: 'Aprobado',    dot: 'bg-mundial-green',       bg: 'bg-mundial-green/10 border-mundial-green/30' },
                rejected: { label: 'Rechazado',   dot: 'bg-mundial-red',         bg: 'bg-mundial-red/10 border-mundial-red/25' },
              }
              return (
                <>
                  <div className="flex items-center gap-3 px-5 py-3 bg-mundial-green/10 border border-mundial-green/30 rounded-2xl">
                    <svg className="w-5 h-5 text-mundial-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="font-condensed text-sm font-bold text-mundial-purple">
                      {mySticker
                        ? `Tu cromo: ${statusConfig[mySticker.status]?.label ?? mySticker.status}`
                        : 'Elegí un slot para crear tu cromo'}
                    </span>
                  </div>
                  {(slotsLoading || !myStickersFetched) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-mundial-cream animate-pulse" />)}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
                      <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin slots definidos</p>
                      <p className="text-sm text-mundial-purple/35">El organizador todavía no creó los slots de esta campaña.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {slots.map((slot) => {
                        const isMySlot = mySticker?.slot_id === slot.id
                        const sticker = isMySlot ? mySticker : null
                        const isLocked = !!mySticker && !isMySlot
                        const cfg = sticker ? statusConfig[sticker.status] : null
                        const canEdit = isMySlot
                          ? (mySticker.status === 'draft' || mySticker.status === 'rejected')
                          : !mySticker
                        return (
                          <div
                            key={slot.id}
                            className={[
                              'relative rounded-2xl border-2 overflow-hidden transition-all duration-200',
                              isLocked
                                ? 'opacity-40 border-mundial-purple/10 bg-mundial-cream/50'
                                : canEdit
                                ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] border-mundial-purple/15 bg-white/70'
                                : cfg?.bg ?? 'border-mundial-purple/15 bg-white/70',
                            ].join(' ')}
                            onClick={() => canEdit && setSelectedSlotForEditor(slot)}
                          >
                            {sticker ? (
                              <div className="aspect-[3/4] bg-mundial-cream">
                                <img src={sticker.image_url} alt="" className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="aspect-[3/4] flex items-center justify-center bg-mundial-cream/50">
                                <div className="text-center space-y-2">
                                  {isLocked ? (
                                    <svg className="w-7 h-7 mx-auto text-mundial-purple/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                  ) : (
                                    <>
                                      <div className="w-10 h-10 mx-auto rounded-xl bg-mundial-purple/10 flex items-center justify-center">
                                        <span className="font-display text-lg text-mundial-purple font-bold">{slot.slot_number}</span>
                                      </div>
                                      <p className="text-xs text-mundial-purple/40 font-condensed font-bold">+ Crear</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="px-3 py-2 space-y-1 bg-white/90 border-t border-mundial-purple/10">
                              <p className="font-display text-xs tracking-wide uppercase text-mundial-purple truncate">
                                #{slot.slot_number} {slot.label ?? ''}
                              </p>
                              {cfg ? (
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  <span className="text-[10px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/60">{cfg.label}</span>
                                </div>
                              ) : (
                                <p className="text-[10px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/35">
                                  {isLocked ? 'Bloqueado' : 'Sin cromo'}
                                </p>
                              )}
                            </div>
                            {sticker?.status === 'rejected' && sticker.rejection_reason && (
                              <div className="absolute top-2 right-2">
                                <div className="w-5 h-5 rounded-full bg-mundial-red flex items-center justify-center" title={sticker.rejection_reason}>
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()
          ) : (
            /* ── Vista participante ── */
            (() => {
              const mySticker = myStickers[0] ?? null
              const myAssignedSlot = slotsFetched ? (slots.find(s => s.assigned_user_id === currentUserId) ?? null) : undefined
              // Si tiene sticker pero sin asignación, recuperar el slot por slot_id del sticker
              const stickerSlot = mySticker ? (slots.find(s => s.id === mySticker.slot_id) ?? null) : null
              const editorSlot = myAssignedSlot ?? stickerSlot
              const statusConfig: Record<string, { label: string; dot: string; bg: string; border: string }> = {
                draft:    { label: 'Borrador',    dot: 'bg-mundial-yellow-dark', bg: 'bg-mundial-yellow/10',  border: 'border-mundial-yellow/30' },
                pending:  { label: 'En revisión', dot: 'bg-mundial-purple',      bg: 'bg-mundial-purple/10', border: 'border-mundial-purple/25' },
                approved: { label: 'Aprobado',    dot: 'bg-mundial-green',       bg: 'bg-mundial-green/10',  border: 'border-mundial-green/30' },
                rejected: { label: 'Rechazado',   dot: 'bg-mundial-red',         bg: 'bg-mundial-red/10',    border: 'border-mundial-red/25' },
              }

              if (!slotsFetched || !myStickersFetched) {
                return <div className="h-56 rounded-2xl bg-mundial-cream animate-pulse" />
              }

              const cfg = mySticker ? statusConfig[mySticker.status] : null
              const canEdit = !mySticker || mySticker.status === 'draft' || mySticker.status === 'rejected'

              return (
                <div className="space-y-4">
                  {/* Badge: slot asignado o sin slot */}
                  {myAssignedSlot ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-mundial-purple/8 border border-mundial-purple/15 rounded-xl w-fit">
                      <span className="font-condensed text-[11px] font-bold tracking-[0.25em] uppercase text-mundial-purple/50">Slot asignado</span>
                      <span className="font-display text-sm font-bold tracking-wider text-mundial-purple">
                        #{myAssignedSlot.slot_number}{myAssignedSlot.label ? ` · ${myAssignedSlot.label}` : ''}
                      </span>
                      {cfg && (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-condensed font-bold tracking-wider uppercase ${cfg.bg} ${cfg.border} border text-mundial-purple/70`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-mundial-yellow/10 border border-mundial-yellow/30 rounded-xl w-fit">
                      <span className="font-condensed text-[11px] font-bold tracking-[0.25em] uppercase text-mundial-yellow-dark">Sin slot asignado</span>
                    </div>
                  )}

                  {mySticker ? (
                    /* Sticker existente */
                    <div className="flex flex-col items-center gap-5">
                      <div className="w-52 rounded-2xl overflow-hidden border-2 border-mundial-purple/15 shadow-md bg-mundial-cream">
                        <img src={mySticker.image_url} alt="Mi sticker" className="w-full object-contain" />
                      </div>
                      {mySticker.status === 'rejected' && mySticker.rejection_reason && (
                        <div className="flex items-start gap-2 px-4 py-3 bg-mundial-red/8 border border-mundial-red/20 rounded-xl max-w-xs">
                          <svg className="w-4 h-4 text-mundial-red shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-mundial-red/80">{mySticker.rejection_reason}</p>
                        </div>
                      )}
                      {mySticker.status === 'approved' && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-mundial-green/10 border border-mundial-green/30 rounded-xl">
                          <svg className="w-4 h-4 text-mundial-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-condensed font-bold text-mundial-green">Tu sticker fue aprobado y está en el álbum</p>
                        </div>
                      )}
                      {mySticker.status === 'pending' && (
                        <p className="text-sm text-mundial-purple/50 font-condensed italic">Tu sticker está siendo revisado por el organizador.</p>
                      )}
                      <div className="flex items-center gap-3">
                        {canEdit && editorSlot && (
                          <button
                            onClick={() => setSelectedSlotForEditor(editorSlot)}
                            className="px-6 py-2.5 rounded-xl bg-mundial-purple text-white text-sm font-condensed font-bold tracking-wider uppercase hover:bg-mundial-purple/90 transition-colors"
                          >
                            Editar sticker
                          </button>
                        )}
                        {mySticker.status !== 'approved' && (
                          confirmDeleteSticker ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteMySticker(mySticker.id)}
                                disabled={deletingSticker}
                                className="px-4 py-2.5 rounded-xl bg-mundial-red text-white text-sm font-condensed font-bold tracking-wider uppercase hover:bg-mundial-red/90 transition-colors disabled:opacity-50"
                              >
                                {deletingSticker ? 'Eliminando…' : '¿Confirmar?'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteSticker(false)}
                                className="px-4 py-2.5 rounded-xl border border-mundial-purple/20 text-mundial-purple/60 text-sm font-condensed font-bold tracking-wider uppercase hover:bg-mundial-purple/5 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteSticker(true)}
                              className="px-4 py-2.5 rounded-xl border border-mundial-red/30 text-mundial-red/70 text-sm font-condensed font-bold tracking-wider uppercase hover:bg-mundial-red/8 hover:border-mundial-red/50 hover:text-mundial-red transition-colors"
                            >
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ) : editorSlot ? (
                    /* Sin sticker, slot conocido — CTA directo */
                    <div
                      onClick={() => setSelectedSlotForEditor(editorSlot)}
                      className="cursor-pointer group text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/20 hover:border-mundial-purple/40 hover:bg-mundial-purple/5 transition-all space-y-3"
                    >
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-mundial-purple/10 group-hover:bg-mundial-purple/15 flex items-center justify-center transition-colors">
                        <svg className="w-7 h-7 text-mundial-purple/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                      </div>
                      <p className="font-display text-base tracking-wider uppercase text-mundial-purple/60 group-hover:text-mundial-purple/80 transition-colors">Crear mi sticker</p>
                      <p className="text-xs text-mundial-purple/35 font-condensed">Subí tu foto y personalizá tu sticker para el álbum</p>
                    </div>
                  ) : (
                    /* Sin sticker y sin slot asignado — grilla para elegir slot */
                    slots.length === 0 ? (
                      <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
                        <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin slots definidos</p>
                        <p className="text-sm text-mundial-purple/35">El organizador todavía no creó los slots de esta campaña.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {slots.map((slot) => (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedSlotForEditor(slot)}
                            className="cursor-pointer group relative rounded-2xl border-2 border-dashed border-mundial-purple/15 bg-white/70 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                          >
                            <div className="aspect-[3/4] flex items-center justify-center bg-mundial-cream/50">
                              <div className="text-center space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-xl bg-mundial-purple/10 group-hover:bg-mundial-purple/15 flex items-center justify-center transition-colors">
                                  <span className="font-display text-lg text-mundial-purple font-bold">{slot.slot_number}</span>
                                </div>
                                <p className="text-xs text-mundial-purple/40 font-condensed font-bold">+ Crear</p>
                              </div>
                            </div>
                            <div className="px-3 py-2 bg-white/90 border-t border-mundial-purple/10">
                              <p className="font-display text-xs tracking-wide uppercase text-mundial-purple truncate">
                                #{slot.slot_number}{slot.label ? ` ${slot.label}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* ── Tab: Revisión (admin) ──────────────────────────────────── */}
      {tab === 'review' && isAdminView && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-mundial-purple/10 border border-mundial-purple/20 rounded-2xl">
            <svg className="w-5 h-5 text-mundial-purple/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-condensed text-sm font-bold text-mundial-purple">
              {pendingStickers.length} cromo{pendingStickers.length !== 1 ? 's' : ''} esperando revisión
            </span>
          </div>

          {!pendingFetched ? (
            <div className="grid gap-4">
              {[1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-mundial-cream animate-pulse" />)}
            </div>
          ) : pendingStickers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-mundial-green/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-mundial-green/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-display text-base tracking-wider uppercase text-mundial-purple/50">Sin cromos pendientes</p>
              <p className="text-sm text-mundial-purple/35">Todos los envíos fueron revisados.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingStickers.map((s) => (
                <div key={s.id} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-4">
                    <img src={s.image_url} alt="" className="w-16 h-20 object-contain rounded-xl border border-mundial-purple/10 bg-mundial-cream shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">
                        {s.username}
                      </p>
                      <p className="text-xs text-mundial-purple/50">
                        Slot {s.slotNumber}{s.slotLabel ? ` · ${s.slotLabel}` : ''}
                      </p>
                      <p className="text-xs text-mundial-purple/40">
                        {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(s.id)}
                        disabled={isReviewing}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-60 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Aprobar
                      </button>
                      <button
                        onClick={() => { setRejectingId(s.id); setRejectReason('') }}
                        disabled={isReviewing}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-mundial-cream hover:bg-mundial-red/10 disabled:opacity-60 text-mundial-red border-2 border-mundial-red/25 hover:border-mundial-red/50 font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Rechazar
                      </button>
                    </div>
                  </div>
                  {/* Rejection form */}
                  {rejectingId === s.id && (
                    <div className="flex gap-2 pt-1 border-t border-mundial-purple/10">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo del rechazo (obligatorio)"
                        className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-mundial-red/30 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-red/60 transition-colors"
                        autoFocus
                      />
                      <button
                        onClick={() => handleReject(s.id)}
                        disabled={!rejectReason.trim() || isReviewing}
                        className="px-4 py-2 bg-mundial-red hover:bg-mundial-red/90 disabled:opacity-40 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                      >
                        {isReviewing ? '…' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason('') }}
                        className="px-3 py-2 text-mundial-purple/50 hover:text-mundial-purple rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Galería ──────────────────────────────────────────── */}
      {tab === 'gallery' && (
        <GalleryView
          album={album}
          currentUserId={currentUserId}
          slots={slots}
          members={members}
        />
      )}

      {/* ── Tab: Intercambios ─────────────────────────────────────── */}
      {tab === 'trades' && (
        <TradeView
          album={album}
          currentUserId={currentUserId}
          slots={slots}
        />
      )}

      {/* ── Tab: Mi Álbum ─────────────────────────────────────────── */}
      {tab === 'album' && (
        <AlbumView
          album={album}
          currentUserId={currentUserId}
          isAdminView={isAdminView}
          slots={slots}
          members={members}
        />
      )}

      {/* ── Perfil de usuario ────────────────────────────────────────── */}
      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          currentUserId={currentUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}

      {/* ── Modal: Editar álbum ──────────────────────────────────────── */}
      {editAlbumOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mundial-navy-deep/60 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setEditAlbumOpen(false) }}
        >
          <div className="w-full max-w-md glass-card rounded-3xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-mundial-purple/10">
              <h3 className="font-display text-lg tracking-wide uppercase text-mundial-purple">Editar álbum</h3>
              <button
                onClick={() => setEditAlbumOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-mundial-purple/8 text-mundial-purple/40 hover:text-mundial-purple transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Form */}
            <form onSubmit={handleSaveAlbum} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-purple/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Descripción
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-purple/50 transition-colors resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Cromos por sobre
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={editPackSize}
                  onChange={(e) => setEditPackSize(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-24 px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple focus:outline-none focus:border-mundial-purple/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Edición de portadas
                </label>
                <select
                  value={editEditionId ?? ''}
                  onChange={e => setEditEditionId(e.target.value || null)}
                  className="w-full px-3 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple text-sm focus:outline-none focus:border-mundial-purple/50 transition-colors"
                >
                  <option value="">Sin edición</option>
                  {coverEditions.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              {albumSaveError && (
                <p className="text-xs text-mundial-red bg-mundial-red/10 border border-mundial-red/20 rounded-xl px-3 py-2">
                  {albumSaveError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditAlbumOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-mundial-purple/20 text-mundial-purple/60 font-display text-sm tracking-wider uppercase hover:border-mundial-purple/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAlbum || !editName.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-60 text-white font-display text-sm tracking-wider uppercase transition-colors"
                >
                  {isSavingAlbum ? '…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Stats (admin) ─────────────────────────────────────── */}
      {tab === 'stats' && isAdminView && (
        <div className="space-y-5">
          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-mundial-cream animate-pulse" />)}
            </div>
          ) : !stats ? (
            <div className="text-center py-14 text-mundial-purple/40 text-sm">Sin datos disponibles.</div>
          ) : (
            <>
              {/* Resumen general */}
              <div className="glass-card rounded-2xl p-5 space-y-3">
                <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Resumen
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Participantes', value: stats.total_members },
                    { label: 'Slots',         value: stats.total_slots   },
                    { label: 'Slots cubiertos', value: stats.slots_covered },
                    { label: 'Cromos total',  value: Object.values(stats.stickers_by_status).reduce((a, b) => a + b, 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-mundial-cream rounded-xl p-3 text-center space-y-0.5">
                      <p className="font-display text-2xl text-mundial-purple">{value}</p>
                      <p className="font-condensed text-[10px] font-bold tracking-[0.15em] uppercase text-mundial-purple/50">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cromos por estado */}
              <div className="glass-card rounded-2xl p-5 space-y-3">
                <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                  Cromos por estado
                </h3>
                <div className="flex flex-wrap gap-3">
                  {([
                    { key: 'draft',    label: 'Borrador',    color: 'bg-gray-100 text-gray-600' },
                    { key: 'pending',  label: 'En revisión', color: 'bg-amber-100 text-amber-700' },
                    { key: 'approved', label: 'Aprobados',   color: 'bg-green-100 text-green-700' },
                    { key: 'rejected', label: 'Rechazados',  color: 'bg-red-100 text-red-700'   },
                  ] as const).map(({ key, label, color }) => (
                    <div key={key} className={`${color} rounded-xl px-4 py-3 flex items-center gap-3 min-w-[120px]`}>
                      <span className="font-display text-2xl">{stats.stickers_by_status[key] ?? 0}</span>
                      <span className="font-condensed text-[10px] font-bold tracking-[0.15em] uppercase leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reacciones */}
              {(Object.keys(stats.reactions_by_emoji).length > 0 || stats.top_reactors.length > 0) && (
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                    Reacciones
                  </h3>
                  <div className="flex flex-wrap gap-4 items-start">
                    {/* Emoji breakdown */}
                    <div className="flex gap-3">
                      {(['❤️','🔥','⭐','😂'] as const).map((emoji) => (
                        <div key={emoji} className="bg-mundial-cream rounded-xl px-3 py-2 text-center min-w-[52px]">
                          <p className="text-xl">{emoji}</p>
                          <p className="font-display text-sm text-mundial-purple">{stats.reactions_by_emoji[emoji] ?? 0}</p>
                        </div>
                      ))}
                    </div>
                    {/* Top reactors */}
                    {stats.top_reactors.length > 0 && (
                      <div className="flex-1 min-w-[180px] space-y-1.5">
                        <p className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/40">Top reactores</p>
                        {stats.top_reactors.map((r, i) => (
                          <div key={r.username} className="flex items-center gap-2">
                            <span className="font-display text-[10px] text-mundial-purple/40 w-4">{i + 1}</span>
                            <span className="text-sm font-medium text-mundial-purple">@{r.username}</span>
                            <span className="ml-auto font-display text-xs text-mundial-purple/60">{r.reaction_count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actividad reciente */}
              {stats.recent_activity.length > 0 && (
                <div className="glass-card rounded-2xl p-5 space-y-3">
                  <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                    Actividad reciente
                  </h3>
                  <div className="space-y-2">
                    {stats.recent_activity.map((item) => {
                      const statusStyles: Record<string, string> = {
                        draft:    'bg-gray-100 text-gray-600',
                        pending:  'bg-amber-100 text-amber-700',
                        approved: 'bg-green-100 text-green-700',
                        rejected: 'bg-red-100 text-red-700',
                      }
                      const statusLabels: Record<string, string> = {
                        draft: 'Borrador', pending: 'Revisión', approved: 'Aprobado', rejected: 'Rechazado',
                      }
                      const ago = (() => {
                        const diff = Date.now() - new Date(item.updated_at).getTime()
                        const m = Math.floor(diff / 60000)
                        if (m < 1) return 'ahora'
                        if (m < 60) return `hace ${m}m`
                        const h = Math.floor(m / 60)
                        if (h < 24) return `hace ${h}h`
                        return `hace ${Math.floor(h / 24)}d`
                      })()
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-mundial-purple/8 last:border-0">
                          <span className={`shrink-0 text-[10px] font-bold font-condensed tracking-wider uppercase px-2 py-0.5 rounded-full ${statusStyles[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[item.status] ?? item.status}
                          </span>
                          <span className="text-sm text-mundial-purple flex-1 truncate">
                            @{item.username}
                            <span className="text-mundial-purple/40"> — Slot {item.slot_number}{item.slot_label ? ` (${item.slot_label})` : ''}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-mundial-purple/35 font-condensed">{ago}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botón refresh */}
              <div className="flex justify-end">
                <button
                  onClick={() => { setStatsFetched(false); fetchStats() }}
                  className="text-xs font-condensed font-bold tracking-wider uppercase text-mundial-purple/40 hover:text-mundial-purple transition-colors"
                >
                  ↻ Actualizar
                </button>
              </div>
            </>
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

          {/* Invitar por email */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
              Invitar por email
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInviteEmail()}
                placeholder="email@ejemplo.com"
                className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder-mundial-purple/30 focus:outline-none focus:border-mundial-purple/50 transition-colors"
              />
              <button
                onClick={handleSendInviteEmail}
                disabled={isSendingInvEmail || !inviteEmail.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-50 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
              >
                {isSendingInvEmail ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                )}
                Enviar
              </button>
            </div>
            {invEmailMsg && (
              <p className={`text-xs ${invEmailMsg.ok ? 'text-green-600' : 'text-mundial-red'}`}>
                {invEmailMsg.text}
              </p>
            )}
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
