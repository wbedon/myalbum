'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const USERNAME_RE = /^[a-zA-Z0-9_.\-]+$/

interface Props {
  user: User
  onComplete: () => void
}

export default function ForceProfileComplete({ user, onComplete }: Props) {
  const [username, setUsername] = useState('')
  const [bio, setBio]           = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) { setError('El nombre de usuario es requerido.'); return }
    if (trimmed.length < 3) { setError('El usuario debe tener al menos 3 caracteres.'); return }
    if (!USERNAME_RE.test(trimmed)) {
      setError('Solo letras, números, puntos, guiones y guiones bajos.')
      return
    }

    setSaving(true)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ username: trimmed, bio: bio.trim() || null, profile_complete: true })
      .eq('user_id', user.id)

    if (updateErr) {
      setError(updateErr.message.includes('duplicate') ? 'Ese nombre de usuario ya está en uso.' : updateErr.message)
      setSaving(false)
      return
    }
    onComplete()
  }

  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col">
      <div className="bg-mundial-navy-deep text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple shadow ring-1 ring-white/20">
            <span className="font-display text-lg leading-none">M</span>
          </div>
          <span className="font-display text-base tracking-widest leading-none">MYALBUM</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-mundial-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl tracking-wide uppercase text-mundial-purple">
              Completá tu perfil
            </h1>
            <p className="text-sm text-mundial-purple/60">
              Elegí un nombre de usuario para que otros te identifiquen en el álbum.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -top-2 -left-2 w-10 h-10 bg-mundial-yellow rounded-tl-2xl rounded-br-2xl z-0 shadow" />
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-mundial-yellow rounded-tr-2xl rounded-bl-2xl z-0 shadow" />

            <div className="relative glass-card rounded-3xl p-8 z-10">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                    Nombre de usuario
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="ej: juan_perez"
                    autoComplete="username"
                    className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                    Bio <span className="normal-case tracking-normal font-normal text-mundial-purple/40">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Contá algo sobre vos…"
                    maxLength={120}
                    className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-mundial-red bg-mundial-red/10 border border-mundial-red/30 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 bg-gradient-to-r from-mundial-purple to-mundial-purple/80 disabled:opacity-60 text-white font-display text-base tracking-wider uppercase rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {saving ? 'Guardando…' : 'Continuar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-host-gradient" />
    </div>
  )
}
