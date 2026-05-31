'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Template } from '@/lib/supabase'

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [newName, setNewName] = useState('')
  const [replacingImage, setReplacingImage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const editImageRef = useRef<HTMLInputElement>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('sort_order', { ascending: true })
    if (data) setTemplates(data as Template[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !newName.trim()) { setUploadError('Ingresá un nombre antes de subir la imagen.'); return }
    setUploadError(null)
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${Date.now()}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('templates')
      .upload(fileName, file, { contentType: file.type, upsert: false })

    if (storageErr) { setUploadError(storageErr.message); setUploading(false); return }

    const { data: urlData } = supabase.storage.from('templates').getPublicUrl(fileName)

    const maxOrder = templates.length > 0 ? Math.max(...templates.map(t => t.sort_order)) + 1 : 0
    const { error: dbErr } = await supabase.from('templates').insert({
      name: newName.trim(),
      image_url: urlData.publicUrl,
      sort_order: maxOrder,
      is_active: true,
    })

    if (dbErr) {
      await supabase.storage.from('templates').remove([fileName])
      setUploadError(dbErr.message)
    } else {
      setNewName('')
      if (fileRef.current) fileRef.current.value = ''
      await fetchTemplates()
    }
    setUploading(false)
  }

  const startEdit = (t: Template) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditOrder(t.sort_order)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    await supabase.from('templates').update({ name: editName.trim(), sort_order: editOrder }).eq('id', editingId)
    setEditingId(null)
    await fetchTemplates()
    setSaving(false)
  }

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>, t: Template) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReplacingImage(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const newFileName = `${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('templates')
      .upload(newFileName, file, { contentType: file.type, upsert: false })

    if (uploadErr) { setReplacingImage(false); return }

    const { data: urlData } = supabase.storage.from('templates').getPublicUrl(newFileName)
    await supabase.from('templates').update({ image_url: urlData.publicUrl }).eq('id', t.id)

    // Delete old image from storage
    const oldFileName = t.image_url.split('/').pop()
    if (oldFileName) await supabase.storage.from('templates').remove([oldFileName])

    // Update local state thumbnail immediately
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, image_url: urlData.publicUrl } : x))
    if (editImageRef.current) editImageRef.current.value = ''
    setReplacingImage(false)
  }

  const toggleActive = async (t: Template) => {
    await supabase.from('templates').update({ is_active: !t.is_active }).eq('id', t.id)
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (t: Template) => {
    setDeleting(true)
    const fileName = t.image_url.split('/').pop()
    if (fileName) await supabase.storage.from('templates').remove([fileName])
    await supabase.from('templates').delete().eq('id', t.id)
    setDeleteId(null)
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-mundial-yellow rounded-full" />
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide uppercase text-mundial-purple">
          Plantillas
        </h2>
      </div>

      {/* Upload form */}
      <div className="glass-card rounded-2xl p-6 border-2 border-mundial-yellow/40 space-y-4">
        <h3 className="font-display text-sm tracking-wider uppercase text-mundial-purple/70">Nueva plantilla</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Nombre (ej: Uruguay)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 text-mundial-purple placeholder:text-mundial-purple/30 focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
          />
          <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-display text-sm tracking-wider uppercase cursor-pointer transition-colors ${uploading ? 'bg-mundial-purple/40 text-white/60' : 'bg-mundial-purple text-white hover:bg-mundial-purple/90'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {uploading ? 'Subiendo…' : 'Subir imagen'}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
        </div>
        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{uploadError}</p>
        )}
      </div>

      {/* Template grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="aspect-[3/4] rounded-2xl bg-mundial-cream animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-mundial-purple/40 font-display tracking-wider uppercase">Sin plantillas</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className={`rounded-2xl overflow-hidden border-2 transition-colors ${t.is_active ? 'border-mundial-green/40' : 'border-mundial-purple/15 opacity-60'}`}>
              {/* Thumbnail */}
              <div className="relative aspect-[3/4] bg-mundial-cream">
                <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                {/* Active badge */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.is_active ? 'bg-mundial-green text-white' : 'bg-mundial-purple/40 text-white'}`}>
                  {t.is_active ? 'Activa' : 'Inactiva'}
                </div>
              </div>

              {/* Info / edit */}
              <div className="bg-white p-3 space-y-2">
                {editingId === t.id ? (
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
                    <label className={`flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-display tracking-wider uppercase rounded-lg cursor-pointer transition-colors ${replacingImage ? 'bg-mundial-purple/20 text-mundial-purple/40' : 'bg-mundial-purple/10 text-mundial-purple hover:bg-mundial-purple/20'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {replacingImage ? 'Subiendo…' : 'Cambiar imagen'}
                      <input ref={editImageRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={replacingImage} onChange={e => handleReplaceImage(e, t)} />
                    </label>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-green text-white rounded-lg hover:bg-mundial-green/90 transition-colors disabled:opacity-50">
                        {saving ? '…' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-purple/10 text-mundial-purple rounded-lg hover:bg-mundial-purple/20 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-display text-sm tracking-wide uppercase text-mundial-purple truncate">{t.name}</p>
                    <p className="text-xs text-mundial-purple/40">Orden: {t.sort_order}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => startEdit(t)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-yellow/20 text-mundial-purple rounded-lg hover:bg-mundial-yellow/40 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => toggleActive(t)} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-mundial-purple/10 text-mundial-purple rounded-lg hover:bg-mundial-purple/20 transition-colors">
                        {t.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => setDeleteId(t.id)} className="py-1.5 px-2.5 text-xs font-display tracking-wider uppercase bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Delete confirm */}
              {deleteId === t.id && (
                <div className="bg-red-50 border-t border-red-100 p-3 space-y-2">
                  <p className="text-xs text-red-600">¿Eliminar esta plantilla? Esta acción no se puede deshacer.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(t)} disabled={deleting} className="flex-1 py-1.5 text-xs font-display tracking-wider uppercase bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
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
