'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Props {
  user: User
  onComplete: () => void
}

export default function ForcePasswordChange({ user, onComplete }: Props) {
  const [newPass, setNewPass]   = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPass !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setSaving(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', user.id)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col">
      {/* Top bar */}
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
          {/* Header */}
          <div className="mb-8 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-mundial-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl tracking-wide uppercase text-mundial-purple">
              Configurá tu contraseña
            </h1>
            <p className="text-sm text-mundial-purple/60">
              Por seguridad, elegí una nueva contraseña antes de continuar.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -top-2 -left-2 w-10 h-10 bg-mundial-yellow rounded-tl-2xl rounded-br-2xl z-0 shadow" />
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-mundial-yellow rounded-tr-2xl rounded-bl-2xl z-0 shadow" />

            <div className="relative glass-card rounded-3xl p-8 z-10">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-mundial-purple/40 hover:text-mundial-purple/70 transition-colors"
                      aria-label={showNewPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showNewPass ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repetí la contraseña"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-mundial-purple/40 hover:text-mundial-purple/70 transition-colors"
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirm ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
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
                  {saving ? 'Guardando…' : 'Confirmar contraseña'}
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
