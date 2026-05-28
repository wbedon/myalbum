'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface InvitationInfo {
  album_id: string
  expires_at: string | null
  max_uses: number | null
  uses_count: number
  campaign_name: string
  campaign_description: string | null
}

type PageStatus = 'loading' | 'valid' | 'invalid' | 'joining' | 'joined' | 'already' | 'error'

export default function JoinPage({ params }: { params: { token: string } }) {
  const { token } = params

  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [status, setStatus] = useState<PageStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Auth form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Fetch invitation + album in two separate queries (join via fk not reliable)
  useEffect(() => {
    const load = async () => {
      const { data: inv, error: invErr } = await supabase
        .from('invitations')
        .select('album_id, expires_at, max_uses, uses_count')
        .eq('token', token)
        .single()

      if (invErr || !inv) {
        setStatus('invalid')
        setErrorMsg('Esta invitación no existe o fue eliminada.')
        return
      }

      const row = inv as {
        album_id: string
        expires_at: string | null
        max_uses: number | null
        uses_count: number
      }

      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        setStatus('invalid')
        setErrorMsg('Esta invitación expiró.')
        return
      }
      if (row.max_uses !== null && row.uses_count >= row.max_uses) {
        setStatus('invalid')
        setErrorMsg('Esta invitación alcanzó el límite de usos.')
        return
      }

      const { data: album } = await supabase
        .from('albums')
        .select('name, description')
        .eq('id', row.album_id)
        .single()

      const a = album as { name: string; description: string | null } | null
      setInfo({
        album_id: row.album_id,
        expires_at: row.expires_at,
        max_uses: row.max_uses,
        uses_count: row.uses_count,
        campaign_name: a?.name ?? 'Campaña',
        campaign_description: a?.description ?? null,
      })
      setStatus('valid')
    }
    load()
  }, [token])

  const handleJoin = async () => {
    setStatus('joining')
    const { data, error } = await supabase.rpc('use_invitation', { p_token: token })
    const result = data as { ok?: boolean; error?: string; already_member?: boolean } | null
    if (error || result?.error) {
      setStatus('error')
      setErrorMsg(result?.error || error?.message || 'Error al unirse a la campaña.')
    } else if (result?.already_member) {
      setStatus('already')
    } else {
      setStatus('joined')
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)
    const email = `${username.trim().toLowerCase()}@myalbum.internal`
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username.trim().toLowerCase() } },
        })
        if (error) throw error
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error de autenticación.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Render helpers ──────────────────────────────────────────────

  if (status === 'loading') {
    return <PageShell><LoadingSpinner /></PageShell>
  }

  if (status === 'invalid') {
    return (
      <PageShell>
        <StatusCard
          icon="error"
          title="Invitación no válida"
          message={errorMsg}
          action={<Link href="/" className="inline-flex px-6 py-3 bg-mundial-purple text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors">Ir al inicio</Link>}
        />
      </PageShell>
    )
  }

  if (status === 'joined') {
    return (
      <PageShell>
        <StatusCard
          icon="success"
          title={`¡Te uniste a ${info?.campaign_name}!`}
          message="Ya podés acceder a la campaña desde tu cuenta."
          action={<Link href="/" className="inline-flex px-6 py-3 bg-mundial-green text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-green/90 transition-colors">Ir a mis campañas</Link>}
        />
      </PageShell>
    )
  }

  if (status === 'already') {
    return (
      <PageShell>
        <StatusCard
          icon="info"
          title="Ya sos participante"
          message={`Ya formas parte de ${info?.campaign_name}.`}
          action={<Link href="/" className="inline-flex px-6 py-3 bg-mundial-purple text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors">Ver mis campañas</Link>}
        />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell>
        <StatusCard
          icon="error"
          title="Error al unirse"
          message={errorMsg}
          action={
            <button onClick={() => setStatus('valid')} className="inline-flex px-6 py-3 bg-mundial-cream text-mundial-purple font-display text-sm tracking-wider uppercase rounded-xl border-2 border-mundial-purple/20 hover:border-mundial-purple/40 transition-colors">
              Intentar de nuevo
            </button>
          }
        />
      </PageShell>
    )
  }

  // status === 'valid' | 'joining'
  return (
    <PageShell>
      <div className="w-full max-w-md space-y-6">
        {/* Campaign card */}
        <div className="glass-card rounded-3xl p-8 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-mundial-yellow-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <div>
            <p className="font-condensed text-xs font-bold tracking-[0.3em] uppercase text-mundial-purple/50 mb-1">
              Fuiste invitado a
            </p>
            <h1 className="font-display text-2xl tracking-wide uppercase text-mundial-purple">
              {info?.campaign_name}
            </h1>
            {info?.campaign_description && (
              <p className="mt-1 text-sm text-mundial-purple/60">{info.campaign_description}</p>
            )}
          </div>
        </div>

        {/* Auth gate or join button */}
        {!authReady ? (
          <LoadingSpinner />
        ) : user ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-mundial-purple/60">
              Conectado como <span className="font-bold text-mundial-purple">
                {(user.user_metadata?.username as string | undefined) ?? user.email?.replace('@myalbum.internal', '')}
              </span>
            </p>
            <button
              onClick={handleJoin}
              disabled={status === 'joining'}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-60 text-white font-display text-base tracking-wider uppercase rounded-2xl shadow-lg transition-colors"
            >
              {status === 'joining' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              )}
              Unirme a la campaña
            </button>
          </div>
        ) : (
          /* Compact auth form */
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg tracking-wide uppercase text-mundial-purple">
                {authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </h2>
              <p className="text-sm text-mundial-purple/60 mt-0.5">
                {authMode === 'login'
                  ? 'Iniciá sesión para unirte a la campaña.'
                  : 'Creá tu cuenta y unite de inmediato.'}
              </p>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-purple/50 transition-colors"
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-purple/50 transition-colors"
              />
              {authError && (
                <p className="text-xs text-mundial-red bg-mundial-red/10 border border-mundial-red/20 rounded-xl px-3 py-2">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-60 text-white font-display text-sm tracking-wider uppercase rounded-xl transition-colors"
              >
                {authLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {authMode === 'login' ? 'Entrar y unirme' : 'Crear cuenta y unirme'}
              </button>
            </form>
            <button
              onClick={() => { setAuthMode((m) => m === 'login' ? 'register' : 'login'); setAuthError(null) }}
              className="text-xs text-mundial-purple/50 hover:text-mundial-purple transition-colors w-full text-center"
            >
              {authMode === 'login' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Iniciá sesión'}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col">
      {/* Mini top bar */}
      <div className="bg-mundial-navy-deep text-white px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple">
          <span className="font-display text-lg leading-none">M</span>
        </div>
        <span className="font-display text-base tracking-widest">MYALBUM</span>
      </div>
      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-mundial-purple/20 border-t-mundial-purple rounded-full animate-spin" />
    </div>
  )
}

function StatusCard({
  icon,
  title,
  message,
  action,
}: {
  icon: 'success' | 'error' | 'info'
  title: string
  message: string
  action?: React.ReactNode
}) {
  const colors = {
    success: 'bg-mundial-green/10 text-mundial-green',
    error: 'bg-mundial-red/10 text-mundial-red',
    info: 'bg-mundial-yellow/10 text-mundial-yellow-dark',
  }
  const icons = {
    success: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    ),
    error: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    ),
    info: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    ),
  }
  return (
    <div className="w-full max-w-sm text-center space-y-4">
      <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${colors[icon]}`}>
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {icons[icon]}
        </svg>
      </div>
      <div>
        <h2 className="font-display text-xl tracking-wide uppercase text-mundial-purple">{title}</h2>
        <p className="mt-1 text-sm text-mundial-purple/60">{message}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
