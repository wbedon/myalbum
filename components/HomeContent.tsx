'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import PhotoUploader from './PhotoUploader'
import PhotoGallery from './PhotoGallery'
import AdminPanel from './AdminPanel'
import MyAlbumsPanel from './MyAlbumsPanel'
import OrganizerDashboard from './OrganizerDashboard'
import HeroSection from './HeroSection'
import { FlagUSA, FlagMexico, FlagCanada } from './MundialDecor'
import Avatar from './Avatar'
import UserProfileModal from './UserProfileModal'
import { supabase } from '@/lib/supabase'
import type { Photo } from '@/lib/supabase'

interface Props {
  user: User
  onLogout: () => Promise<void>
}

export default function HomeContent({ user, onLogout }: Props) {
  const [galleryKey, setGalleryKey] = useState(0)
  const [preloaded, setPreloaded] = useState<{ url: string; id: number } | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [hasCampaigns, setHasCampaigns] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMyCampaigns, setShowMyCampaigns] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const uploaderRef = useRef<HTMLDivElement>(null)

  const username: string = (user.user_metadata?.username as string | undefined)
    ?? user.email?.split('@')[0]
    ?? user.id.slice(0, 8)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('role').eq('user_id', user.id).single(),
      supabase.from('album_members').select('album_id').eq('user_id', user.id).limit(1),
    ]).then(([profileRes, membershipsRes]) => {
      const role = (profileRes.data as { role: string } | null)?.role ?? 'user'
      const hasMemberships = !!(membershipsRes.data && (membershipsRes.data as { album_id: string }[]).length > 0)

      if (role === 'superadmin') { setIsSuperAdmin(true); setShowAdmin(true) }
      if (role === 'organizer')  { setIsOrganizer(true); setShowMyCampaigns(true) }
      if (role !== 'superadmin' && role !== 'organizer' && hasMemberships) {
        setShowMyCampaigns(true)
      }

      setHasCampaigns(hasMemberships)
      setInitialized(true)
    })
  }, [user.id])

  // ── Web Push subscription ──────────────────────────────────────
  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'denied') return
    Notification.requestPermission().then((perm) => {
      if (perm !== 'granted') return
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          const existing = await reg.pushManager.getSubscription()
          const sub = existing ?? await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
            ) as BufferSource,
          })
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON(), userId: user.id }),
          })
        } catch { /* permission granted but subscribe failed — silently ignore */ }
      })
    })

    function urlBase64ToUint8Array(b64: string): Uint8Array {
      const padding = '='.repeat((4 - (b64.length % 4)) % 4)
      const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = atob(base64)
      return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)))
    }
  }, [user.id])

  const scrollToUploader = () => {
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSelectFromGallery = useCallback((photo: Photo) => {
    setPreloaded({ url: photo.processed_url, id: Date.now() })
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleUploaderReset = useCallback(() => {
    setPreloaded(null)
  }, [])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-mundial-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-mundial-purple/20 border-t-mundial-purple animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col relative">
      {/* ============== TOP BAR ============== */}
      <div className="relative bg-mundial-navy-deep text-white z-20">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple shadow ring-1 ring-white/20">
              <span className="font-display text-lg leading-none">M</span>
            </div>
            <span className="font-display text-base tracking-widest leading-none">MYALBUM</span>
            <span className="hidden sm:inline-block w-px h-3 bg-white/20" />
            <span className="hidden sm:inline-block text-[10px] font-condensed font-bold tracking-[0.25em] uppercase text-white/60">
              Mundial 2026 Edition
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Panel Admin — solo superadmin */}
              {isSuperAdmin && (
                <button
                  onClick={() => { setShowAdmin((v) => !v); setShowMyCampaigns(false) }}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-condensed tracking-wider uppercase transition-colors',
                    showAdmin
                      ? 'bg-mundial-yellow text-mundial-purple'
                      : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white',
                  ].join(' ')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {showAdmin ? 'Mi App' : 'Admin'}
                </button>
              )}
              {/* Avatar / Mi Perfil */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors group"
                title="Mi perfil"
              >
                <Avatar username={username} size="xs" />
                <span className="hidden sm:inline-block text-[10px] text-white/60 group-hover:text-white/90 font-condensed tracking-wide max-w-[120px] truncate transition-colors">
                  {username}
                </span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-condensed tracking-wider uppercase transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============== HERO ============== */}
      {!showAdmin && !showMyCampaigns && <HeroSection onStartClick={scrollToUploader} />}

      {/* ============== MAIN ============== */}
      <main className={['relative flex-1 max-w-5xl w-full mx-auto px-4 space-y-20', (showAdmin || showMyCampaigns) ? 'py-10' : 'py-16 sm:py-20'].join(' ')}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden -z-0"
        >
          <div className="absolute -right-32 top-32 w-[700px] h-[700px] opacity-[0.06] mask-fade-radial">
            <Image
              src="/img/hero/player-silhouette.webp"
              alt=""
              width={1400}
              height={930}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {showAdmin && (
          <div className="relative z-10">
            <AdminPanel userId={user.id} />
          </div>
        )}

        {showMyCampaigns && !showAdmin && (
          <div className="relative z-10">
            {isOrganizer
              ? <OrganizerDashboard userId={user.id} />
              : <MyAlbumsPanel userId={user.id} />
            }
          </div>
        )}

        <div className={['relative z-10 space-y-20', (showAdmin || showMyCampaigns) ? 'hidden' : ''].join(' ')}>
          {/* ============== UPLOADER SECTION ============== */}
          <section ref={uploaderRef} className="scroll-mt-20">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-3 mb-3">
                <span className="h-px w-12 bg-mundial-purple/30" />
                <span className="font-condensed text-xs font-bold tracking-[0.3em] uppercase text-mundial-purple/60">
                  Paso 1 de 1
                </span>
                <span className="h-px w-12 bg-mundial-purple/30" />
              </div>
              <h2 className="font-display text-3xl sm:text-4xl tracking-wide uppercase text-mundial-purple leading-tight">
                Subí tu foto y armá tu sticker
              </h2>
              <p className="mt-3 text-mundial-purple/70 max-w-md mx-auto text-sm">
                La IA quita el fondo, vos elegís la plantilla y la posicionás como quieras.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -top-3 -left-3 w-16 h-16 bg-mundial-yellow rounded-tl-3xl rounded-br-3xl z-0 shadow-lg" />
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-mundial-yellow rounded-tr-3xl rounded-bl-3xl z-0 shadow-lg" />
              <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-host-gradient rounded-br-3xl rounded-tl-3xl z-0 shadow-md opacity-90" />

              <div className="relative glass-card rounded-3xl p-6 sm:p-10 z-10">
                <PhotoUploader
                  onPhotoSaved={() => setGalleryKey((k) => k + 1)}
                  preloaded={preloaded}
                  onReset={handleUploaderReset}
                  userId={user.id}
                />
              </div>
            </div>
          </section>

          {/* ============== DIVISOR HOST TRICOLOR ============== */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-mundial-purple/10" />
            <div className="flex items-center gap-2">
              <FlagUSA className="h-4 w-6 rounded-sm shadow ring-1 ring-mundial-purple/10" />
              <FlagMexico className="h-4 w-6 rounded-sm shadow ring-1 ring-mundial-purple/10" />
              <FlagCanada className="h-4 w-6 rounded-sm shadow ring-1 ring-mundial-purple/10" />
            </div>
            <div className="h-px flex-1 bg-mundial-purple/10" />
          </div>

          {/* ============== GALERÍA ============== */}
          <section id="galeria" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-8 bg-mundial-red rounded-full" />
              <h3 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
                Mi Álbum
              </h3>
              <span className="h-px flex-1 bg-mundial-purple/15" />
            </div>
            <PhotoGallery
              key={galleryKey}
              onSelectPhoto={handleSelectFromGallery}
              onPhotoDeleted={() => setGalleryKey((k) => k + 1)}
            />
          </section>
        </div>
      </main>

      {/* ============== FOOTER ============== */}
      <footer className="relative bg-mundial-navy-deep text-white mt-12 overflow-hidden">
        <div className="h-1.5 bg-host-gradient" />
        <div className="absolute inset-0 bg-hexagons opacity-50 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-md bg-mundial-yellow flex items-center justify-center text-mundial-purple ring-1 ring-white/20">
                <span className="font-display text-lg leading-none">M</span>
              </div>
              <span className="font-display text-xl tracking-widest">MYALBUM</span>
            </div>
            <p className="text-xs text-white/50 font-condensed">
              Editor de stickers Mundialista. Recortá tu foto y compartila con tu plantilla favorita.
            </p>
          </div>

          <div>
            <p className="font-condensed text-[11px] font-bold tracking-[0.25em] uppercase text-mundial-yellow mb-3">
              Sedes
            </p>
            <div className="flex flex-col gap-2 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <FlagUSA className="h-3.5 w-5 rounded-sm" />
                <span>Estados Unidos</span>
              </div>
              <div className="flex items-center gap-2">
                <FlagMexico className="h-3.5 w-5 rounded-sm" />
                <span>México</span>
              </div>
              <div className="flex items-center gap-2">
                <FlagCanada className="h-3.5 w-5 rounded-sm" />
                <span>Canadá</span>
              </div>
            </div>
          </div>

          <div>
            <p className="font-condensed text-[11px] font-bold tracking-[0.25em] uppercase text-mundial-yellow mb-3">
              Características
            </p>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li>· Procesamiento 100% local</li>
              <li>· Sin servidores, sin costos</li>
              <li>· Open source</li>
              <li>· Proyecto académico</li>
            </ul>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <span className="font-condensed text-[10px] tracking-[0.25em] uppercase text-white/40">
              MyAlbum · Mundial 26 Edition
            </span>
            <span className="font-condensed text-[10px] tracking-[0.25em] uppercase text-white/40">
              v1.0
            </span>
          </div>
        </div>
      </footer>

      {showProfile && (
        <UserProfileModal
          userId={user.id}
          currentUserId={user.id}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}
