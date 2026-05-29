'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Phase = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Supabase processes the #access_token hash and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPhase('form')
      }
    })

    // Fallback: if session already established (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPhase('form')
    })

    // If no event fires within 5s, show invalid link message
    const timeout = setTimeout(() => {
      setPhase((p) => p === 'loading' ? 'invalid' : p)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setIsSubmitting(false)
    } else {
      setPhase('success')
      setTimeout(() => router.push('/'), 2500)
    }
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
          <div className="relative mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="h-px w-10 bg-mundial-purple/30" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-mundial-yellow to-mundial-yellow-dark flex items-center justify-center shadow-lg">
                <span className="font-display text-3xl leading-none text-mundial-purple">M</span>
              </div>
              <span className="h-px w-10 bg-mundial-purple/30" />
            </div>
            <h1 className="font-display text-3xl tracking-wide uppercase text-mundial-purple">
              Nueva contraseña
            </h1>
          </div>

          <div className="relative">
            <div className="absolute -top-2 -left-2 w-10 h-10 bg-mundial-yellow rounded-tl-2xl rounded-br-2xl z-0 shadow" />
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-mundial-yellow rounded-tr-2xl rounded-bl-2xl z-0 shadow" />

            <div className="relative glass-card rounded-3xl p-8 z-10">
              {phase === 'loading' && (
                <div className="flex justify-center py-6">
                  <div className="w-8 h-8 border-4 border-mundial-purple/20 border-t-mundial-purple rounded-full animate-spin" />
                </div>
              )}

              {phase === 'invalid' && (
                <div className="space-y-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-mundial-red/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-mundial-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-mundial-purple/70">
                    El enlace expiró o no es válido. Solicitá uno nuevo.
                  </p>
                  <Link href="/" className="block w-full py-3 bg-mundial-purple text-white font-display text-sm tracking-wider uppercase rounded-xl text-center hover:opacity-90 transition-opacity">
                    Volver al inicio
                  </Link>
                </div>
              )}

              {phase === 'success' && (
                <div className="space-y-4 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-mundial-green/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-mundial-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-display text-lg tracking-wide uppercase text-mundial-purple">Contraseña actualizada</p>
                    <p className="text-sm text-mundial-purple/60 mt-1">Redirigiendo...</p>
                  </div>
                </div>
              )}

              {phase === 'form' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-mundial-purple/70">
                    Elegí una nueva contraseña para tu cuenta.
                  </p>

                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Nueva contraseña
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Confirmar contraseña
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repetí la contraseña"
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
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-mundial-purple to-mundial-purple/80 disabled:opacity-60 disabled:cursor-not-allowed text-white font-display text-base tracking-wider uppercase rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Guardar contraseña
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-host-gradient" />
    </div>
  )
}
