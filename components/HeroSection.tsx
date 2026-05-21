'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { FlagUSA, FlagMexico, FlagCanada } from './MundialDecor'

interface Props {
  onStartClick?: () => void
}

/**
 * Hero cinematográfico al estilo FIFA / EA Sports FC menus.
 *
 * Estructura:
 *   - Background dark con gradient mesh (stadium lights)
 *   - Partículas animadas subiendo lentamente
 *   - Foto full-bleed del jugador pateando, con mask gradient
 *   - Overlay oscuro elegante para contraste
 *   - Cápsula glass de "SEDES" con banderas grandes
 *   - Título display con gradient trophy
 *   - Línea tricolor (colores USA/MEX/CAN)
 *   - CTA "Empezar ya" con glow rojo
 */
export default function HeroSection({ onStartClick }: Props) {
  const [particles, setParticles] = useState<Array<{ x: number; delay: number; duration: number; size: number }>>([])

  // Genera partículas una sola vez (en cliente, para evitar mismatch SSR)
  useEffect(() => {
    setParticles(
      Array.from({ length: 14 }).map(() => ({
        x: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 10 + Math.random() * 8,
        size: 2 + Math.random() * 3,
      }))
    )
  }, [])

  return (
    <section className="relative overflow-hidden bg-stadium-mesh text-white">
      {/* ============ FOTO FULL-BLEED DEL JUGADOR ============ */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/hero/player-kick.webp"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-50 mask-fade-bottom animate-slow-zoom"
          sizes="100vw"
        />
        {/* Overlay oscuro para mejorar contraste del texto */}
        <div className="absolute inset-0 bg-gradient-to-b from-mundial-navy-deep/70 via-mundial-navy/60 to-mundial-navy-deep" />
        {/* Tinte verde sutil para integrar con la paleta */}
        <div className="absolute inset-0 bg-gradient-to-tr from-mundial-green/20 via-transparent to-mundial-turquoise/10 mix-blend-overlay" />
      </div>

      {/* ============ PARTÍCULAS DE LUZ FLOTANTES ============ */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full bg-mundial-yellow/60 animate-float-up"
            style={{
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              boxShadow: '0 0 8px rgba(245,196,46,0.8)',
            }}
          />
        ))}
      </div>

      {/* ============ STADIUM LIGHTS — pulse en gradientes ============ */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-mundial-turquoise/20 rounded-full blur-3xl stadium-pulse pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-mundial-yellow/15 rounded-full blur-3xl stadium-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* ============ CONTENIDO ============ */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">
        {/* Cápsula de SEDES con banderas grandes */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 glass-dark rounded-full mb-8 animate-fade-up shimmer-on-hover">
          <span className="font-condensed text-[11px] sm:text-xs font-bold tracking-[0.3em] uppercase text-white/70">
            Sedes
          </span>
          <div className="w-px h-4 bg-white/25" />
          <FlagUSA className="h-5 w-7 rounded-sm shadow-md ring-1 ring-white/30" />
          <FlagMexico className="h-5 w-7 rounded-sm shadow-md ring-1 ring-white/30" />
          <FlagCanada className="h-5 w-7 rounded-sm shadow-md ring-1 ring-white/30" />
          <div className="w-px h-4 bg-white/25" />
          <span className="font-display text-base sm:text-lg tracking-wider text-mundial-yellow leading-none">
            26
          </span>
        </div>

        {/* Título display gigante */}
        <h1
          className="font-display text-5xl sm:text-7xl md:text-8xl tracking-tight uppercase leading-[0.95] animate-fade-up"
          style={{ animationDelay: '150ms' }}
        >
          <span className="block text-gradient-trophy drop-shadow-[0_4px_30px_rgba(245,196,46,0.4)]">
            Hacé tu
          </span>
          <span className="block text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] mt-1">
            sticker del
          </span>
          <span className="block text-gradient-trophy drop-shadow-[0_4px_40px_rgba(245,196,46,0.5)] mt-1">
            Mundial.
          </span>
        </h1>

        {/* Línea decorativa tricolor */}
        <div
          className="mx-auto mt-8 h-1 w-32 sm:w-48 rounded-full bg-host-gradient animate-fade-up"
          style={{ animationDelay: '300ms' }}
        />

        {/* Descripción */}
        <p
          className="mt-6 text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed animate-fade-up font-condensed font-medium"
          style={{ animationDelay: '400ms' }}
        >
          Subí tu foto, la IA quita el fondo y elegí tu plantilla.
          <br className="hidden sm:inline" />
          <span className="text-mundial-yellow font-bold tracking-wide">
            100% en tu navegador. Sin servidores. Sin costos.
          </span>
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: '550ms' }}
        >
          <button
            type="button"
            onClick={onStartClick}
            className="group inline-flex items-center gap-2 px-6 py-3.5 bg-mundial-red text-white font-condensed text-sm font-bold tracking-widest uppercase rounded-xl btn-glow-red"
          >
            <span>Crear mi sticker</span>
            <svg
              className="w-7 h-7 transition-transform duration-300 group-hover:translate-x-1.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>

          <a
            href="#galeria"
            className="inline-flex items-center gap-2 px-6 py-3.5 glass-dark text-white font-condensed text-sm font-bold tracking-widest uppercase rounded-xl hover:bg-white/15 transition-colors"
          >
            Ver galería
          </a>
        </div>

        {/* Indicador scroll abajo */}
        <div
          className="mt-16 hidden sm:flex justify-center animate-fade-up"
          style={{ animationDelay: '800ms' }}
        >
          <div className="flex flex-col items-center gap-2 text-white/40">
            <span className="font-condensed text-[10px] tracking-[0.3em] uppercase">Scroll</span>
            <svg className="w-4 h-4 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* ============ BORDE INFERIOR: BANDA TRICOLOR HOST ============ */}
      <div className="relative h-2 bg-host-gradient z-10" />
    </section>
  )
}
