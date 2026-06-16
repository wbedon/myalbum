'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationType } from '@/lib/supabase'

interface Props {
  albumId: string
  refreshKey?: number
  onTabBadge?: (counts: TabBadgeCounts) => void
}

export interface TabBadgeCounts {
  stickers: number
  album: number
  trades: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

function notifIcon(type: NotificationType): string {
  switch (type) {
    case 'sticker_approved': return '✅'
    case 'sticker_rejected': return '❌'
    case 'trade_requested':  return '🔄'
    case 'trade_accepted':   return '🤝'
    case 'pack_available':    return '🎁'
    case 'sticker_commented': return '💬'
  }
}

function notifMessage(n: Notification): string {
  const p = n.payload as Record<string, unknown>
  switch (n.type) {
    case 'sticker_approved':
      return `Tu sticker para el slot #${p.slot_number}${p.slot_label ? ` (${p.slot_label})` : ''} fue aprobado.`
    case 'sticker_rejected': {
      const reason = p.rejection_reason ? ` Motivo: ${p.rejection_reason}` : ''
      return `Tu sticker para el slot #${p.slot_number}${p.slot_label ? ` (${p.slot_label})` : ''} fue rechazado.${reason}`
    }
    case 'trade_requested':
      return `${p.requester_username} quiere intercambiar: te ofrece slot #${p.req_slot_number}${p.req_slot_label ? ` (${p.req_slot_label})` : ''} por tu slot #${p.offer_slot_number}${p.offer_slot_label ? ` (${p.offer_slot_label})` : ''}.`
    case 'trade_accepted':
      return `${p.offerer_username} aceptó tu solicitud. Recibiste slot #${p.got_slot_number}${p.got_slot_label ? ` (${p.got_slot_label})` : ''}.`
    case 'pack_available':
      return `¡Tienes un sobre disponible con ${p.pack_size} stickers! Ábrelo en Mi Álbum.`
    case 'sticker_commented': {
      const preview = p.content_preview ? ` "${p.content_preview}"` : ''
      return `Alguien comentó en tu sticker:${preview}`
    }
  }
}

function tabFor(type: NotificationType): keyof TabBadgeCounts {
  if (type === 'sticker_approved' || type === 'sticker_rejected' || type === 'sticker_commented') return 'stickers'
  if (type === 'pack_available') return 'album'
  return 'trades'
}

export default function NotificationsPanel({ albumId, refreshKey, onTabBadge }: Props) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  async function fetchNotifs() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) {
      setNotifs(data as Notification[])
      if (onTabBadge) {
        const counts: TabBadgeCounts = { stickers: 0, album: 0, trades: 0 }
        for (const n of data as Notification[]) {
          if (!n.read) counts[tabFor(n.type)]++
        }
        onTabBadge(counts)
      }
    }
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)

    // Realtime: INSERT en notifications para este álbum
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return
      channel = supabase
        .channel(`notifs:${albumId}:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as Notification
            if (n.album_id !== albumId) return
            setNotifs((prev) => [n, ...prev])
            if (onTabBadge) {
              setNotifs((prev) => {
                const counts: TabBadgeCounts = { stickers: 0, album: 0, trades: 0 }
                for (const notif of prev) {
                  if (!notif.read) counts[tabFor(notif.type)]++
                }
                onTabBadge(counts)
                return prev
              })
            }
          }
        )
        .subscribe()
    })

    return () => {
      clearInterval(interval)
      if (channel) supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId])

  // Re-fetch when parent marks notifications as read (tab switch)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) fetchNotifs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = notifs.filter(n => !n.read).length

  async function markAllRead() {
    const ids = notifs.filter(n => !n.read).map(n => n.id)
    if (ids.length === 0) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    if (onTabBadge) onTabBadge({ stickers: 0, album: 0, trades: 0 })
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (onTabBadge) {
      const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n)
      const counts: TabBadgeCounts = { stickers: 0, album: 0, trades: 0 }
      for (const n of updated) {
        if (!n.read) counts[tabFor(n.type)]++
      }
      onTabBadge(counts)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl glass-card hover:scale-105 transition-transform"
        title="Notificaciones"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(320px,92vw)] max-h-[70vh] overflow-y-auto rounded-2xl glass-card shadow-2xl z-50 border border-white/20">
          <div className="flex items-center justify-between p-3 border-b border-white/20 sticky top-0 glass-card">
            <span className="font-semibold text-sm">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Sin notificaciones</div>
          ) : (
            <ul>
              {notifs.map(n => (
                <li
                  key={n.id}
                  className={`flex gap-3 p-3 border-b border-white/10 last:border-0 cursor-pointer hover:bg-white/5 transition-colors ${n.read ? 'opacity-60' : ''}`}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${n.read ? 'text-gray-400' : 'text-white'}`}>
                      {notifMessage(n)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
