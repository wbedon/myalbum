'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import HomeContent from './HomeContent'
import { FlagUSA, FlagMexico, FlagCanada } from './MundialDecor'

type AuthMode = 'login' | 'register'

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registerDone, setRegisterDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setRegisterDone(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación'
      setError(
        msg.includes('Invalid login credentials')
          ? 'Email o contraseña incorrectos.'
          : msg.includes('Email not confirmed')
          ? 'Debés confirmar tu email antes de ingresar. Revisá tu bandeja de entrada.'
          : msg.includes('already registered')
          ? 'Ese email ya está registrado. Iniciá sesión.'
          : msg.includes('Password should be at least')
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : msg
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mundial-cream flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-mundial-purple/20 border-t-mundial-purple animate-spin" />
      </div>
    )
  }

  if (user) {
    return <HomeContent user={user} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col">
      {/* Top bar */}
      <div className="bg-mundial-navy-deep text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple shadow ring-1 ring-white/20">
              <span className="font-display text-lg leading-none">M</span>
            </div>
            <span className="font-display text-base tracking-widest leading-none">MYALBUM</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 glass-dark rounded-full">
            <FlagUSA className="h-3 w-4 rounded-sm" />
            <FlagMexico className="h-3 w-4 rounded-sm" />
            <FlagCanada className="h-3 w-4 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Decoración */}
          <div className="relative mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="h-px w-10 bg-mundial-purple/30" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-mundial-yellow to-mundial-yellow-dark flex items-center justify-center shadow-lg">
                <span className="font-display text-3xl leading-none text-mundial-purple">M</span>
              </div>
              <span className="h-px w-10 bg-mundial-purple/30" />
            </div>
            <h1 className="font-display text-3xl tracking-wide uppercase text-mundial-purple">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h1>
            <p className="mt-1 text-sm text-mundial-purple/60">
              {mode === 'login'
                ? 'Accedé a tu álbum personal'
                : 'Creá tu álbum del Mundial 2026'}
            </p>
          </div>

          {/* Card */}
          <div className="relative">
            <div className="absolute -top-2 -left-2 w-10 h-10 bg-mundial-yellow rounded-tl-2xl rounded-br-2xl z-0 shadow" />
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-mundial-yellow rounded-tr-2xl rounded-bl-2xl z-0 shadow" />

            <div className="relative glass-card rounded-3xl p-8 z-10">
              {registerDone ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-mundial-green/15 flex items-center justify-center">
                    <svg className="w-8 h-8 text-mundial-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="font-display text-lg tracking-wider uppercase text-mundial-purple">
                    ¡Cuenta creada!
                  </p>
                  <p className="text-sm text-mundial-purple/70">
                    Revisá tu email para confirmar tu cuenta y luego iniciá sesión.
                  </p>
                  <button
                    onClick={() => { setMode('login'); setRegisterDone(false) }}
                    className="mt-2 w-full py-3 bg-mundial-purple text-white font-display tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors"
                  >
                    Ir al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Contraseña
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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
                    {isSubmitting && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                  </button>

                  <p className="text-center text-sm text-mundial-purple/60">
                    {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
                    <button
                      type="button"
                      onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
                      className="font-semibold text-mundial-purple underline underline-offset-2 hover:text-mundial-green transition-colors"
                    >
                      {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
                    </button>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer mínimo */}
      <div className="bg-mundial-navy-deep h-1.5 bg-host-gradient" />
    </div>
  )
}
