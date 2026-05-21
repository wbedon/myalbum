'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import PhotoUploader from './PhotoUploader'
import PhotoGallery from './PhotoGallery'
import HeroSection from './HeroSection'
import { FlagUSA, FlagMexico, FlagCanada } from './MundialDecor'

export default function HomeContent() {
  const [galleryKey, setGalleryKey] = useState(0)
  const uploaderRef = useRef<HTMLDivElement>(null)

  const scrollToUploader = () => {
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-mundial-cream flex flex-col relative">
      {/* ============== TOP BAR fina con identidad de marca ============== */}
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

          <div className="flex items-center gap-1.5 px-2.5 py-1 glass-dark rounded-full">
            <FlagUSA className="h-3 w-4 rounded-sm" />
            <FlagMexico className="h-3 w-4 rounded-sm" />
            <FlagCanada className="h-3 w-4 rounded-sm" />
          </div>
        </div>
      </div>

      {/* ============== HERO ============== */}
      <HeroSection onStartClick={scrollToUploader} />

      {/* ============== MAIN ============== */}
      <main className="relative flex-1 max-w-5xl w-full mx-auto px-4 py-16 sm:py-20 space-y-20">
        {/* Marca de agua: foto del balón en cancha, sutil */}
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

        {/* Contenido por encima de la marca de agua */}
        <div className="relative z-10 space-y-20">
          {/* ============== UPLOADER SECTION ============== */}
          <section ref={uploaderRef} className="scroll-mt-20">
            {/* Header de sección */}
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

            {/* Card glassmorphism con ribbons amarillas en esquinas */}
            <div className="relative">
              <div className="absolute -top-3 -left-3 w-16 h-16 bg-mundial-yellow rounded-tl-3xl rounded-br-3xl z-0 shadow-lg" />
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-mundial-yellow rounded-tr-3xl rounded-bl-3xl z-0 shadow-lg" />
              <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-host-gradient rounded-br-3xl rounded-tl-3xl z-0 shadow-md opacity-90" />

              <div className="relative glass-card rounded-3xl p-6 sm:p-10 z-10">
                <PhotoUploader onPhotoSaved={() => setGalleryKey((k) => k + 1)} />
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
            <PhotoGallery key={galleryKey} />
          </section>
        </div>
      </main>

      {/* ============== FOOTER ============== */}
      <footer className="relative bg-mundial-navy-deep text-white mt-12 overflow-hidden">
        {/* Banda tricolor host arriba */}
        <div className="h-1.5 bg-host-gradient" />

        {/* Subtle hex pattern overlay */}
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
    </div>
  )
}
