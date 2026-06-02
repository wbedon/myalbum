'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type CoverEdition } from '@/lib/supabase'

function extractStoragePath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/templates\/(.+)/)
  return match ? match[1] : null
}

const UploadIcon = () => (
  <svg className="w-6 h-6 mx-auto text-mundial-purple/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
)

export default function CoverEditionManager() {
  const [editions, setEditions] = useState<CoverEdition[]>([])
  const [loading, setLoading] = useState(true)

  // ── Nuevo ──────────────────────────────────────────────────────
  const [newName, setNewName] = useState('')
  const [newPortadaFile, setNewPortadaFile] = useState<File | null>(null)
  const [newContraFile, setNewContraFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Editar ─────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState(0)
  const [editSaving, setEditSaving] = useState(false)
  const [replacingPortada, setReplacingPortada] = useState(false)
  const [replacingContra, setReplacingContra] = useState(false)

  // ── Eliminar ───────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const portadaRef    = useRef<HTMLInputElement>(null)
  const contraRef     = useRef<HTMLInputElement>(null)
  const editPortadaRef = useRef<HTMLInputElement>(null)
  const editContraRef  = useRef<HTMLInputElement>(null)

  const fetchEditions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cover_editions')
      .select('*')
      .order('sort_order', { ascending: true })
    if (data) setEditions(data as CoverEdition[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEditions() }, [fetchEditions])

  const handleCreate = async () => {
    if (!newName.trim() || !newPortadaFile || !newContraFile) {
      setCreateError('Completá el nombre y subí ambas imágenes.')
      return
    }
    setCreateError(null)
    setCreating(true)

    const t = Date.now()
    const ext1 = newPortadaFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const ext2 = newContraFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const pPath = `covers/portada-${t}.${ext1}`
    const cPath = `covers/contraportada-${t + 1}.${ext2}`

    const [r1, r2] = await Promise.all([
      supabase.storage.from('templates').upload(pPath, newPortadaFile, { contentType: newPortadaFile.type, upsert: false }),
      supabase.storage.from('templates').upload(cPath, newContraFile, { contentType: newContraFile.type, upsert: false }),
    ])

    if (r1.error || r2.error) {
      if (!r1.error) await supabase.storage.from('templates').remove([pPath])
      if (!r2.error) await supabase.storage.from('templates').remove([cPath])
      setCreateError((r1.error ?? r2.error)!.message)
      setCreating(false)
      return
    }

    const portadaUrl = supabase.storage.from('templates').getPublicUrl(pPath).data.publicUrl
    const contraUrl  = supabase.storage.from('templates').getPublicUrl(cPath).data.publicUrl
    const maxOrder   = editions.length > 0 ? Math.max(...editions.map(e => e.sort_order)) + 1 : 0

    const { error: dbErr } = await supabase.from('cover_editions').insert({
      name: newName.trim(),
      portada_url: portadaUrl,
      contraportada_url: contraUrl,
      sort_order: maxOrder,
      is_active: true,
    })

    if (dbErr) {
      await supabase.storage.from('templates').remove([pPath, cPath])
      setCreateError(dbErr.message)
    } else {
      setNewName('')
      setNewPortadaFile(null)
      setNewContraFile(null)
      if (portadaRef.current) portadaRef.current.value = ''
      if (contraRef.current) contraRef.current.value = ''
      await fetchEditions()
    }
    setCreating(false)
  }

  const startEdit = (e: CoverEdition) => {
    setEditingId(e.id)
    setEditName(e.name)
    setEditOrder(e.sort_order)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setEditSaving(true)
    await supabase.from('cover_editions').update({ name: editName.trim(), sort_order: editOrder }).eq('id', editingId)
    setEditingId(null)
    await fetchEditions()
    setEditSaving(false)
  }

  const handleReplaceImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    edition: CoverEdition,
    which: 'portada' | 'contraportada'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    which === 'portada' ? setReplacingPortada(true) : setReplacingContra(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const newPath = `covers/${which}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('templates').upload(newPath, file, { contentType: file.type, upsert: false })

    if (!error) {
      const newUrl = supabase.storage.from('templates').getPublicUrl(newPath).data.publicUrl
      const field  = which === 'portada' ? 'portada_url' : 'contraportada_url'
      await supabase.from('cover_editions').update({ [field]: newUrl }).eq('id', edition.id)
      const oldPath = extractStoragePath(which === 'portada' ? edition.portada_url : edition.contraportada_url)
      if (oldPath) await supabase.storage.from('templates').remove([oldPath])
      setEditions(prev => prev.map(x => x.id === edition.id ? { ...x, [field]: newUrl } : x))
    }

    if (which === 'portada') { if (editPortadaRef.current) editPortadaRef.current.value = ''; setReplacingPortada(false) }
    else                     { if (editContraRef.current)  editContraRef.current.value  = ''; setReplacingContra(false) }
  }

  const toggleActive = async (edition: CoverEdition) => {
    await supabase.from('cover_editions').update({ is_active: !edition.is_active }).eq('id', edition.id)
    setEditions(prev => prev.map(x => x.id === edition.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (edition: CoverEdition) => {
    setDeleting(true)
    const paths = [extractStoragePath(edition.portada_url), extractStoragePath(edition.contraportada_url)].filter(Boolean) as string[]
    if (paths.length) await supabase.storage.from('templates').remove(paths)
    await supabase.from('cover_editions').delete().eq('id', edition.id)
    setDeleteId(null)
    setEditions(prev => prev.filter(x => x.id !== edition.id))
    setDeleting(false)
  }

  const canCreate = !!(newName.trim() && newPortadaFile && newContraFile)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
          Portadas
        </h2>
      </div>

      {/* Crear edición */}
      <div className="glass-card rounded-2xl p-6 border-2 border-mundial-yellow/40 space-y-4">
        <h3 className="font-display text-sm tracking-wider uppercase text-mundial-purple/70">Nueva edición</h3>
        <input
          type="text"
          placeholder="Nombre de la edición (ej: Mundial 2026)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
        />
        <div className="grid grid-cols-2 gap-3">
          {/* Portada picker */}
          <div className="space-y-1.5">
            <p className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-mundial-purple/50">Portada</p>
            <label className={`flex items-center justify-center w-full aspect-[3/4] rounded-xl border-2 cursor-pointer transition-colors overflow-hidden ${newPortadaFile ? 'border-mundial-green/60' : 'border-dashed border-mundial-purple/20 bg-mundial-cream/30 hover:border-mundial-purple/40'}`}>
              {newPortadaFile
                ? <img src={URL.createObjectURL(newPortadaFile)} alt="" className="w-full h-full object-cover" />
                : <div className="text-center space-y-1 p-2"><UploadIcon /><span className="text-[9px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/40">Subir portada</span></div>
              }
              <input ref={portadaRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setNewPortadaFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {/* Contraportada picker */}
          <div className="space-y-1.5">
            <p className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-mundial-purple/50">Contraportada</p>
            <label className={`flex items-center justify-center w-full aspect-[3/4] rounded-xl border-2 cursor-pointer transition-colors overflow-hidden ${newContraFile ? 'border-mundial-green/60' : 'border-dashed border-mundial-purple/20 bg-mundial-cream/30 hover:border-mundial-purple/40'}`}>
              {newContraFile
                ? <img src={URL.createObjectURL(newContraFile)} alt="" className="w-full h-full object-cover" />
                : <div className="text-center space-y-1 p-2"><UploadIcon /><span className="text-[9px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/40">Subir contraportada</span></div>
              }
              <input ref={contraRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setNewContraFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-display text-sm tracking-wider uppercase transition-colors ${!canCreate || creating ? 'bg-mundial-purple/30 text-white/50 cursor-not-allowed' : 'bg-mundial-purple text-white hover:bg-mundial-purple/90'}`}
        >
          {creating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {creating ? 'Creando…' : 'Crear edición'}
        </button>
        {createError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{createError}</p>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-48 rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : editions.length === 0 ? (
        <div className="text-center py-16 text-mundial-purple/40 font-display tracking-wider uppercase">Sin ediciones</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {editions.map(edition => (
            <div key={edition.id} className={`rounded-2xl overflow-hidden border-2 transition-colors ${edition.is_active ? 'border-mundial-green/40' : 'border-mundial-purple/15 opacity-60'}`}>
              {/* Thumbnails par */}
              <div className="relative grid grid-cols-2 gap-px bg-mundial-cream/60">
                <div className="relative aspect-[3/4] overflow-hidden bg-mundial-cream">
                  <img src={edition.portada_url} alt="Portada" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-mundial-yellow text-mundial-purple text-[8px] font-bold uppercase leading-none">P</span>
                </div>
                <div className="relative aspect-[3/4] overflow-hidden bg-mundial-cream">
                  <img src={edition.contraportada_url} alt="Contraportada" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-mundial-purple/80 text-white text-[8px] font-bold uppercase leading-none">C</span>
                </div>
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${edition.is_active ? 'bg-mundial-green text-white' : 'bg-mundial-purple/40 text-white'}`}>
                  {edition.is_active ? 'Activa' : 'Inactiva'}
                </div>
              </div>

              {/* Info / editar */}
              <div className="bg-white p-3 space-y-2">
                {editingId === edition.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border-2 border-mundial-purple/20 focus:outline-none focus:border-mundial-green"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-mundial-purple/50">Orden</label>
                      <input
                        type="number"
                        value={editOrder}
                        onChange={e => setEditOrder(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm rounded-lg border-2 border-mundial-purple/20 focus:outline-none focus:border-mundial-green"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center justify-center gap-1 py-1.5 text-[10px] font-display tracking-wider uppercase rounded-lg cursor-pointer transition-colors ${replacingPortada ? 'bg-mundial-purple/20 text-mundial-purple/40' : 'bg-mundial-yellow/20 text-mundial-purple hover:bg-mundial-yellow/40'}`}>
                        {replacingPortada ? '…' : 'Cambiar portada'}
                        <input ref={editPortadaRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={replacingPortada} onChange={e => handleReplaceImage(e, edition, 'portada')} />
                      </label>
                      <label className={`flex items-center justify-center gap-1 py-1.5 text-[10px] font-display tracking-wider uppercase rounded-lg cursor-pointer transition-colors ${replacingContra ? 'bg-mundial-purple/20 text-mundial-purple/40' : 'bg-mundial-purple/10 text-mundial-purple hover:bg-mundial-purple/20'}`}>
                        {replacingContra ? '…' : 'Cambiar contraportada'}
                        <input ref={editContraRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={replacingContra} onChange={e => handleReplaceImage(e, edition, 'contraportada')} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={editSaving} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-green text-white rounded-lg hover:bg-mundial-green/90 transition-colors disabled:opacity-50">
                        {editSaving ? '…' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-purple/10 text-mundial-purple rounded-lg hover:bg-mundial-purple/20 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-display text-sm tracking-wide uppercase text-mundial-purple truncate">{edition.name}</p>
                    <p className="text-xs text-mundial-purple/40">Orden: {edition.sort_order}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => startEdit(edition)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-yellow/20 text-mundial-purple rounded-lg hover:bg-mundial-yellow/40 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => toggleActive(edition)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-purple/10 text-mundial-purple rounded-lg hover:bg-mundial-purple/20 transition-colors">
                        {edition.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => setDeleteId(edition.id)} className="py-1.5 px-2.5 text-xs font-display tracking-wider uppercase bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Confirmar eliminación */}
              {deleteId === edition.id && (
                <div className="bg-red-50 border-t border-red-100 p-3 space-y-2">
                  <p className="text-xs text-red-600">¿Eliminar esta edición? Se borrarán ambas imágenes.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(edition)} disabled={deleting} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                      {deleting ? '…' : 'Sí, eliminar'}
                    </button>
                    <button onClick={() => setDeleteId(null)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-white text-mundial-purple rounded-lg border border-mundial-purple/20 hover:bg-mundial-purple/5 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
