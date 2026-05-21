'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Photo } from '@/lib/supabase'

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Photo | null>(null)

  useEffect(() => {
    // Si no hay credenciales reales de Supabase, no intentes consultarla
    // (evita errores de CORS contra el placeholder).
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    async function fetchPhotos() {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60)
        if (!error && data) setPhotos(data as Photo[])
      } catch {
        // Error de red — galería vacía
      } finally {
        setLoading(false)
      }
    }
    fetchPhotos()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-mundial-cream animate-pulse" />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-mundial-purple/50 space-y-2 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15">
        <div className="text-4xl">📷</div>
        {isSupabaseConfigured ? (
          <>
            <p className="font-display text-lg tracking-wider uppercase text-mundial-purple/70">
              Sin fotos todavía
            </p>
            <p className="text-xs">Procesá una foto y tocá &ldquo;Guardar en álbum&rdquo; para verla aquí.</p>
          </>
        ) : (
          <>
            <p className="font-display text-lg tracking-wider uppercase text-mundial-purple/70">
              Álbum desactivado
            </p>
            <p className="text-xs max-w-xs mx-auto">
              Configurá Supabase en{' '}
              <code className="bg-mundial-yellow/20 px-1 py-0.5 rounded font-mono text-mundial-purple">
                .env.local
              </code>{' '}
              para activar el álbum.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo)}
            className="aspect-square rounded-xl overflow-hidden border-2 border-mundial-purple/10 bg-checkerboard hover:shadow-lg hover:scale-[1.03] hover:border-mundial-green transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mundial-green"
          >
            <img
              src={photo.processed_url}
              alt="Foto sin fondo"
              className="w-full h-full object-contain"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-checkerboard">
              <img
                src={selected.processed_url}
                alt="Foto sin fondo"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>
            <div className="bg-white p-4 flex gap-3">
              <a
                href={selected.processed_url}
                download="foto-sin-fondo.png"
                className="flex-1 text-center py-2.5 px-4 bg-mundial-red hover:bg-mundial-red-dark text-white font-display tracking-wider uppercase rounded-xl transition-colors"
              >
                Descargar
              </a>
              <button
                onClick={() => setSelected(null)}
                className="py-2.5 px-4 bg-mundial-cream hover:bg-mundial-yellow/40 text-mundial-purple font-display tracking-wider uppercase rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
