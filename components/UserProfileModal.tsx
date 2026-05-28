'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AchievementType } from '@/lib/supabase'
import Avatar, { avatarColor } from './Avatar'

interface AchievementEntry {
  type: AchievementType
  earned_at: string
}

interface UserStats {
  user_id: string
  username: string
  bio: string | null
  role: string
  created_at: string
  stickers_approved: number
  albums_count: number
  trades_completed: number
  achievements: AchievementEntry[]
}

interface AchievementDef {
  type: AchievementType
  emoji: string
  title: string
  desc: string
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { type: 'first_sticker_submitted', emoji: '✏️', title: 'Primer Cromo',     desc: 'Enviaste tu primer cromo a revisión'  },
  { type: 'first_sticker_approved',  emoji: '🎨', title: 'Aprobado',         desc: 'Tu primer cromo fue aprobado'         },
  { type: 'sticker_approved_5',      emoji: '⭐', title: 'Artista',          desc: '5 cromos aprobados en total'          },
  { type: 'first_pack_opened',       emoji: '🎁', title: 'Primer Sobre',     desc: 'Abriste tu primer sobre'              },
  { type: 'first_card_collected',    emoji: '📸', title: 'Coleccionista',    desc: 'Primera carta en tu colección'        },
  { type: 'collector_10',            emoji: '📚', title: 'Gran Colección',   desc: '10 cartas en tu colección'            },
  { type: 'first_trade',             emoji: '🤝', title: 'Intercambiador',   desc: 'Primer intercambio completado'        },
  { type: 'trader_5',                emoji: '🔄', title: 'Negociador',       desc: '5 intercambios completados'           },
  { type: 'album_complete',          emoji: '🏆', title: '¡Álbum Completo!', desc: 'Completaste un álbum entero'          },
]

interface Props {
  userId: string
  currentUserId: string
  onClose: () => void
}

export default function UserProfileModal({ userId, currentUserId, onClose }: Props) {
  const isOwn = userId === currentUserId
  const overlayRef = useRef<HTMLDivElement>(null)

  const [stats, setStats]           = useState<UserStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue]     = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.rpc('get_user_stats', { p_user_id: userId })
      if (data) {
        const s = data as UserStats
        setStats(s)
        setBioValue(s.bio ?? '')
      }
      setLoading(false)
    }
    load()
  }, [userId])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function saveBio() {
    if (!stats) return
    setSaving(true)
    await supabase.from('profiles').update({ bio: bioValue.trim() || null }).eq('user_id', userId)
    setStats((prev) => prev ? { ...prev, bio: bioValue.trim() || null } : prev)
    setEditingBio(false)
    setSaving(false)
  }

  const joinYear = stats ? new Date(stats.created_at).getFullYear() : null
  const color    = stats ? avatarColor(stats.username ?? '') : '#7C3AED'

  const earnedTypes = new Set((stats?.achievements ?? []).map((a) => a.type))
  const earnedCount = earnedTypes.size

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative w-full max-w-sm glass-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
        {/* Color band */}
        <div className="h-2 w-full shrink-0" style={{ backgroundColor: color }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-mundial-purple/40 hover:text-mundial-purple hover:bg-mundial-purple/10 transition-colors z-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="w-20 h-20 rounded-full bg-mundial-cream animate-pulse mx-auto" />
              <div className="h-4 w-32 rounded bg-mundial-cream animate-pulse mx-auto" />
              <div className="h-3 w-48 rounded bg-mundial-cream animate-pulse mx-auto" />
            </div>
          ) : !stats ? (
            <div className="p-8 text-center text-sm text-mundial-purple/40">Perfil no encontrado.</div>
          ) : (
            <div className="p-6 space-y-5">

              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <Avatar username={stats.username ?? '?'} size="xl" />
                <div className="text-center space-y-1">
                  <h2 className="font-display text-xl tracking-widest uppercase text-mundial-purple">
                    {stats.username}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    {stats.role === 'superadmin' && (
                      <span className="text-[9px] font-condensed font-bold tracking-[0.2em] uppercase bg-mundial-yellow/30 text-mundial-yellow-dark px-2 py-0.5 rounded-full">
                        Superadmin
                      </span>
                    )}
                    {joinYear && (
                      <span className="text-xs text-mundial-purple/40 font-condensed">
                        Desde {joinYear}
                      </span>
                    )}
                    {earnedCount > 0 && (
                      <span className="text-xs text-mundial-purple/40 font-condensed">
                        · {earnedCount} logro{earnedCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                {editingBio ? (
                  <div className="space-y-2">
                    <textarea
                      value={bioValue}
                      onChange={(e) => setBioValue(e.target.value)}
                      maxLength={140}
                      rows={3}
                      autoFocus
                      placeholder="Escribe algo sobre ti…"
                      className="w-full px-3 py-2 text-sm rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-yellow/60 resize-none transition-colors"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-mundial-purple/30">{bioValue.length}/140</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingBio(false); setBioValue(stats.bio ?? '') }}
                          className="px-3 py-1.5 text-xs text-mundial-purple/50 hover:text-mundial-purple rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveBio}
                          disabled={saving}
                          className="px-3 py-1.5 text-xs bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-60 text-mundial-purple font-bold rounded-lg transition-colors"
                        >
                          {saving ? '…' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 min-h-[36px]">
                    <p className={[
                      'flex-1 text-sm leading-snug',
                      stats.bio ? 'text-mundial-purple/70' : 'text-mundial-purple/30 italic',
                    ].join(' ')}>
                      {stats.bio ?? (isOwn ? 'Sin bio — haz clic para agregar' : 'Sin bio')}
                    </p>
                    {isOwn && (
                      <button
                        onClick={() => setEditingBio(true)}
                        className="shrink-0 p-1 rounded-lg text-mundial-purple/30 hover:text-mundial-purple hover:bg-mundial-purple/10 transition-colors"
                        title="Editar bio"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1 px-2 py-3 bg-mundial-purple/5 rounded-2xl">
                  <span className="font-display text-2xl text-mundial-purple">{stats.stickers_approved}</span>
                  <span className="font-condensed text-[9px] font-bold tracking-[0.15em] uppercase text-mundial-purple/50 text-center leading-tight">
                    Cromos<br/>aprobados
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 px-2 py-3 bg-mundial-yellow/10 rounded-2xl">
                  <span className="font-display text-2xl text-mundial-purple">{stats.albums_count}</span>
                  <span className="font-condensed text-[9px] font-bold tracking-[0.15em] uppercase text-mundial-purple/50 text-center leading-tight">
                    Álbumes<br/>activos
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 px-2 py-3 bg-mundial-green/8 rounded-2xl">
                  <span className="font-display text-2xl text-mundial-purple">{stats.trades_completed}</span>
                  <span className="font-condensed text-[9px] font-bold tracking-[0.15em] uppercase text-mundial-purple/50 text-center leading-tight">
                    Intercambios<br/>completados
                  </span>
                </div>
              </div>

              {/* Achievements */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
                    Logros
                  </h3>
                  <span className="font-condensed text-[10px] text-mundial-purple/30">
                    {earnedCount}/{ACHIEVEMENT_DEFS.length}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {ACHIEVEMENT_DEFS.map((def) => {
                    const earned = earnedTypes.has(def.type)
                    const entry  = stats.achievements.find((a) => a.type === def.type)
                    return (
                      <div
                        key={def.type}
                        title={earned ? `${def.desc}\n${new Date(entry!.earned_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : def.desc}
                        className={[
                          'flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl border transition-all',
                          earned
                            ? 'bg-mundial-yellow/10 border-mundial-yellow/40'
                            : 'bg-mundial-cream/60 border-mundial-purple/8 opacity-40',
                        ].join(' ')}
                      >
                        <span className={['text-xl', earned ? '' : 'grayscale'].join(' ')}>
                          {def.emoji}
                        </span>
                        <span className={[
                          'font-condensed text-[9px] font-bold tracking-wide uppercase text-center leading-tight',
                          earned ? 'text-mundial-purple' : 'text-mundial-purple/50',
                        ].join(' ')}>
                          {def.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
