'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album } from '@/lib/supabase'
import AlbumDetail from './AlbumDetail'

interface Props {
  userId: string
}

export default function AdminPanel({ userId }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)

  const fetchAlbums = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('albums')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setAlbums(data as Album[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAlbums() }, [fetchAlbums])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    setError(null)
    const { error } = await supabase.from('albums').insert({
      name: name.trim(),
      description: description.trim() || null,
      created_by: userId,
    })
    if (error) {
      setError(error.message)
    } else {
      setName('')
      setDescription('')
      setShowForm(false)
      fetchAlbums()
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    await supabase.from('albums').delete().eq('id', id)
    setAlbums((prev) => prev.filter((a) => a.id !== id))
    setDeleteId(null)
    setIsDeleting(false)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  // Vista detalle de álbum seleccionado
  if (selectedAlbum) {
    return (
      <AlbumDetail
        album={selectedAlbum}
        currentUserId={userId}
        canAssignAdmin={true}
        onBack={() => setSelectedAlbum(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
              Panel Administrador
            </h2>
          </div>
          <p className="ml-5 text-sm text-mundial-purple/60">
            {albums.length} álbum{albums.length !== 1 ? 'es' : ''} creado{albums.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-mundial-yellow hover:bg-mundial-yellow-dark text-mundial-purple font-display text-sm tracking-wider uppercase rounded-xl shadow-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {showForm
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            }
          </svg>
          {showForm ? 'Cancelar' : 'Crear álbum'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div className="glass-card rounded-2xl p-6 border-2 border-mundial-yellow/40">
          <h3 className="font-display text-lg tracking-wider uppercase text-mundial-purple mb-5">
            Nuevo Álbum
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                Nombre del álbum *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Escuela de Fútbol 2026"
                className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-display text-xs text-mundial-purple/70 uppercase tracking-[0.2em]">
                Descripción <span className="normal-case font-sans font-normal text-mundial-purple/40">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del álbum..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors resize-none"
              />
            </div>
            {error && (
              <div className="text-sm text-mundial-red bg-mundial-red/10 border border-mundial-red/30 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-mundial-purple disabled:opacity-60 text-white font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/90 transition-colors"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Crear álbum
            </button>
          </form>
        </div>
      )}

      {/* Lista de álbumes */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-mundial-yellow/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-mundial-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p className="font-display text-lg tracking-wider uppercase text-mundial-purple/60">Sin álbumes todavía</p>
          <p className="text-sm text-mundial-purple/40">Creá el primer álbum con el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {albums.map((album) => (
            <div key={album.id} className="glass-card rounded-2xl p-5 flex items-center gap-4 group">
              {/* Ícono — click abre detalle */}
              <button
                onClick={() => setSelectedAlbum(album)}
                className="flex-1 flex items-center gap-4 text-left min-w-0"
              >
                <div className="w-12 h-12 rounded-xl bg-mundial-yellow/20 flex items-center justify-center shrink-0 group-hover:bg-mundial-yellow/40 transition-colors">
                  <svg className="w-6 h-6 text-mundial-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base tracking-wide uppercase text-mundial-purple truncate group-hover:text-mundial-green transition-colors">
                    {album.name}
                  </p>
                  {album.description && (
                    <p className="text-sm text-mundial-purple/60 truncate mt-0.5">{album.description}</p>
                  )}
                  <p className="text-xs text-mundial-purple/40 mt-1">Creado el {formatDate(album.created_at)}</p>
                </div>
                <svg className="w-5 h-5 text-mundial-purple/20 group-hover:text-mundial-green transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Eliminar */}
              <div className="flex items-center gap-2 shrink-0">
                {deleteId === album.id ? (
                  <>
                    <button onClick={() => handleDelete(album.id)} disabled={isDeleting} className="px-3 py-1.5 bg-mundial-red text-white text-xs font-display tracking-wider uppercase rounded-lg disabled:opacity-60">
                      {isDeleting ? '…' : 'Confirmar'}
                    </button>
                    <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 bg-mundial-cream text-mundial-purple text-xs font-display tracking-wider uppercase rounded-lg">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteId(album.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-mundial-red/10 text-mundial-red/60 hover:text-mundial-red transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
