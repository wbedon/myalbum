'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import HomeContent from './HomeContent'
import ForcePasswordChange from './ForcePasswordChange'
import ForceProfileComplete from './ForceProfileComplete'

type AuthMode = 'login' | 'register' | 'forgot'

const USERNAME_RE = /^[a-zA-Z0-9_.\-]+$/

export default function AuthGate() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [profileComplete, setProfileComplete]       = useState(true)

  const loadProfileFlags = (userId: string) => {
    supabase.from('profiles').select('must_change_password, profile_complete').eq('user_id', userId).single()
      .then(({ data }: { data: { must_change_password: boolean; profile_complete: boolean } | null }) => {
        if (data?.must_change_password) setMustChangePassword(true)
        if (data?.profile_complete === false) setProfileComplete(false)
      })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfileFlags(u.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password')
        return
      }
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadProfileFlags(u.id)
      } else {
        setMustChangePassword(false)
        setProfileComplete(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setSuccessMsg(null)
    setEmail('')
    setUsername('')
    setPassword('')
    setConfirm('')
    setShowPassword(false)
    setShowConfirm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError('El email es requerido.'); return }

    if (mode === 'register') {
      const trimmedUsername = username.trim()
      if (!trimmedUsername) { setError('El nombre de usuario es requerido.'); return }
      if (!USERNAME_RE.test(trimmedUsername)) {
        setError('El usuario solo puede contener letras, números, puntos, guiones y guiones bajos.')
        return
      }
      if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    }

    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        if (error) throw error
      } else {
        const trimmedUsername = username.trim()
        const { error: signUpErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { username: trimmedUsername },
          },
        })
        if (signUpErr) throw signUpErr
        // El trigger auto-confirma; ingresamos directo
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (loginErr) throw loginErr
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación'
      setError(
        msg.includes('Invalid login credentials')
          ? 'Email o contraseña incorrectos.'
          : msg.includes('already registered') || msg.includes('User already registered')
          ? 'Ese email ya está registrado. Intentá iniciar sesión.'
          : msg.includes('Email not confirmed')
          ? 'Necesitás confirmar tu email antes de ingresar.'
          : msg.includes('Password should be at least')
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : msg
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError('El email es requerido.'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
      if (error) throw error
      setSuccessMsg('Te enviamos un email con el enlace para restablecer tu contraseña. Revisá tu casilla (y la carpeta de spam).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el email.')
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

  if (user && mustChangePassword) {
    return <ForcePasswordChange user={user} onComplete={() => setMustChangePassword(false)} />
  }

  if (user && !profileComplete) {
    return <ForceProfileComplete user={user} onComplete={() => setProfileComplete(true)} />
  }

  if (user) {
    return <HomeContent user={user} onLogout={handleLogout} />
  }

  const headings: Record<AuthMode, { title: string; subtitle: string }> = {
    login:    { title: 'Iniciar sesión',    subtitle: 'Accedé a tu álbum personal' },
    register: { title: 'Crear cuenta',      subtitle: 'Creá tu álbum del Mundial 2026' },
    forgot:   { title: 'Recuperar cuenta',  subtitle: 'Te enviamos un enlace por email' },
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
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="relative mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="h-px w-10 bg-mundial-purple/30" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-mundial-yellow to-mundial-yellow-dark flex items-center justify-center shadow-lg">
                <span className="font-display text-3xl leading-none text-mundial-purple">M</span>
              </div>
              <span className="h-px w-10 bg-mundial-purple/30" />
            </div>
            <h1 className="font-display text-3xl tracking-wide uppercase text-mundial-purple">
              {headings[mode].title}
            </h1>
            <p className="mt-1 text-sm text-mundial-purple/60">
              {headings[mode].subtitle}
            </p>
          </div>

          <div className="relative">
            <div className="absolute -top-2 -left-2 w-10 h-10 bg-mundial-yellow rounded-tl-2xl rounded-br-2xl z-0 shadow" />
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-mundial-yellow rounded-tr-2xl rounded-bl-2xl z-0 shadow" />

            <div className="relative glass-card rounded-3xl p-8 z-10">

              {/* ── Forgot password ── */}
              {mode === 'forgot' ? (
                <div className="space-y-4">
                  {successMsg ? (
                    <>
                      <div className="flex items-start gap-2 text-sm text-mundial-green bg-mundial-green/10 border border-mundial-green/30 rounded-xl px-4 py-3">
                        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {successMsg}
                      </div>
                      <p className="text-center text-sm text-mundial-purple/60">
                        <button type="button" onClick={() => switchMode('login')}
                          className="font-semibold text-mundial-purple underline underline-offset-2 hover:text-mundial-green transition-colors">
                          Volver al inicio de sesión
                        </button>
                      </p>
                    </>
                  ) : (
                    <form onSubmit={handleForgot} className="space-y-4">
                      <p className="text-sm text-mundial-purple/70">
                        Ingresá tu email y te enviamos un enlace para restablecer tu contraseña.
                      </p>
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-email" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                          Email
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tu@email.com"
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
                        Enviar enlace
                      </button>
                      <p className="text-center text-sm text-mundial-purple/60">
                        <button type="button" onClick={() => switchMode('login')}
                          className="font-semibold text-mundial-purple underline underline-offset-2 hover:text-mundial-green transition-colors">
                          Volver al inicio de sesión
                        </button>
                      </p>
                    </form>
                  )}
                </div>
              ) : (
              /* ── Login / Register ── */
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Username — solo en registro */}
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label htmlFor="username" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Nombre de usuario
                    </label>
                    <input
                      id="username"
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: jugador10"
                      className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Contraseña
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-mundial-purple/50 hover:text-mundial-purple transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-mundial-purple/40 hover:text-mundial-purple/70 transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
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

                {/* Confirmar contraseña — solo en registro */}
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="confirm"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repetí la contraseña"
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
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-mundial-red bg-mundial-red/10 border border-mundial-red/30 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Submit */}
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
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
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

      <div className="h-1.5 bg-host-gradient" />
    </div>
  )
}
