'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Photo } from '@/lib/supabase'

interface Props {
  onSelectPhoto?: (photo: Photo) => void
  onPhotoDeleted?: () => void
}

export default function PhotoGallery({ onSelectPhoto, onPhotoDeleted }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
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

  const handleDelete = async () => {
    if (!selected) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await supabase.storage.from('photos').remove([`processed/${selected.id}.png`])
      const { error } = await supabase.from('photos').delete().eq('id', selected.id)
      if (error) throw error
      setPhotos((prev) => prev.filter((p) => p.id !== selected.id))
      closeLightbox()
      onPhotoDeleted?.()
    } catch {
      setDeleteError('No se pudo eliminar. Intentá de nuevo.')
      setIsDeleting(false)
    }
  }

  const closeLightbox = () => {
    setSelected(null)
    setConfirmDelete(false)
    setDeleteError(null)
    setIsDeleting(false)
  }

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
            onClick={() => { setSelected(photo); setConfirmDelete(false); setDeleteError(null) }}
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
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              onClick={closeLightbox}
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-checkerboard">
              <img
                src={selected.processed_url}
                alt="Foto sin fondo"
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            </div>

            {!confirmDelete ? (
              <div className="bg-white p-4 space-y-3">
                {/* Usar esta foto */}
                {onSelectPhoto && (
                  <button
                    onClick={() => { onSelectPhoto(selected); closeLightbox() }}
                    className="w-full py-2.5 px-4 bg-mundial-green hover:bg-mundial-green/90 text-white font-display tracking-wider uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Usar esta foto
                  </button>
                )}

                <div className="flex gap-2">
                  <a
                    href={selected.processed_url}
                    download="foto-sin-fondo.png"
                    className="flex-1 text-center py-2.5 px-4 bg-mundial-red hover:bg-mundial-red-dark text-white font-display tracking-wider uppercase rounded-xl transition-colors"
                  >
                    Descargar
                  </a>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="py-2.5 px-4 border-2 border-mundial-red/30 text-mundial-red hover:bg-mundial-red/10 font-display tracking-wider uppercase rounded-xl transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 space-y-3">
                <p className="font-display text-sm tracking-wider uppercase text-mundial-purple text-center">
                  ¿Eliminar esta foto?
                </p>
                {deleteError && (
                  <p className="text-xs text-mundial-red text-center">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 px-4 bg-mundial-red hover:bg-mundial-red-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-display tracking-wider uppercase rounded-xl transition-colors"
                  >
                    {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 px-4 bg-mundial-cream hover:bg-mundial-yellow/40 text-mundial-purple font-display tracking-wider uppercase rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
