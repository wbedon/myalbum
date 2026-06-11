'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase, type AlbumSlot, type Sticker, type Template, type Uniform } from '@/lib/supabase'
import { composeWithTemplate, type Transform, type CropBox } from '@/lib/compose'
import TemplatePicker from './TemplatePicker'
import CompositionEditor from './CompositionEditor'

const LOCAL_UNIFORMS_BY_NAME: Record<string, string> = {
  argentina: '/uniforms/argentina.png',
  brasil: '/uniforms/brasil.png',
  colombia: '/uniforms/colombia.png',
  ecuador: '/uniforms/ecuador.png',
  venezuela: '/uniforms/venezuela.png',
}


type Stage = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface Props {
  albumId: string
  slot: AlbumSlot
  currentUserId: string
  existingSticker: Sticker | null
  onSave: (sticker: Sticker) => void
  onClose: () => void
  hideSlotLabel?: boolean
}

export default function StickerEditor({ albumId, slot, currentUserId, existingSticker, onSave, onClose, hideSlotLabel = false }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [hasCameraSupport, setHasCameraSupport] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMode, setSaveMode] = useState<'draft' | 'pending' | null>(null)

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedUniform, setSelectedUniform] = useState<Uniform | null>(null)
  const [withUniform, setWithUniform] = useState(true)
  const [transform, setTransform] = useState<Transform | null>(null)
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 })
  const [uniformTransform, setUniformTransform] = useState<Transform | null>(null)
  const [uniformCrop, setUniformCrop] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 })
  const [playerName, setPlayerName] = useState<string>('')
  const [clubName, setClubName] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const origUrlRef = useRef<string | null>(null)
  const procUrlRef = useRef<string | null>(null)
  const transformRef = useRef<Transform | null>(null)

  useEffect(() => {
    setHasCameraSupport(!!(navigator.mediaDevices?.getUserMedia))
  }, [])

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [showCamera])

  useEffect(() => {
    return () => {
      if (origUrlRef.current) URL.revokeObjectURL(origUrlRef.current)
      if (procUrlRef.current) URL.revokeObjectURL(procUrlRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!selectedTemplate) { setTransform(null); return }
    const sa = selectedTemplate.safe_area
    setTransform(sa ? { x: sa.x, y: sa.y, width: sa.width } : { x: 0, y: 0, width: 1 })
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
  }, [selectedTemplate])

  useEffect(() => {
    if (!selectedTemplate) { setSelectedUniform(null); return }
    const uniformUrl = selectedTemplate.uniform_url
      ?? LOCAL_UNIFORMS_BY_NAME[selectedTemplate.name.toLowerCase()]
      ?? null
    setSelectedUniform(uniformUrl
      ? { id: 'tpl-uniform', name: selectedTemplate.name, image_url: uniformUrl, sort_order: 0, is_active: true, created_at: '' }
      : null
    )
  }, [selectedTemplate])

  useEffect(() => { transformRef.current = transform }, [transform])

  useEffect(() => {
    if (!selectedUniform) { setUniformTransform(null); setUniformCrop({ x: 0, y: 0, w: 1, h: 1 }); return }
    const t = transformRef.current
    setUniformTransform(t ? { x: t.x, y: t.y + 0.30, width: t.width } : { x: 0.05, y: 0.35, width: 0.9 })
    setUniformCrop({ x: 0, y: 0, w: 1, h: 1 })
  }, [selectedUniform])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Por favor subí una imagen válida (JPG, PNG, WebP).'); return }
    if (file.size > 10 * 1024 * 1024) { setError('La imagen no puede superar los 10 MB.'); return }

    setError(null)
    setProcessedBlob(null)
    if (procUrlRef.current) { URL.revokeObjectURL(procUrlRef.current); procUrlRef.current = null }
    if (origUrlRef.current) { URL.revokeObjectURL(origUrlRef.current); origUrlRef.current = null }
    setProcessedUrl(null)

    const url = URL.createObjectURL(file)
    origUrlRef.current = url
    setOriginalUrl(url)
    setStage('loading')
    setProgressPct(0)
    setProgressLabel('Cargando modelo de IA…')

    try {
      // @ts-ignore - dynamic CDN import, avoids webpack/onnxruntime issues
      const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0')
      const removeBackground = mod.removeBackground as (
        file: File,
        config?: {
          publicPath?: string; model?: string; device?: string
          proxyToWorker?: boolean; debug?: boolean
          progress?: (key: string, current: number, total: number) => void
        }
      ) => Promise<Blob>

      setStage('processing')
      setProgressLabel('Eliminando fondo…')

      const result = await removeBackground(file, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        model: 'medium',
        device: 'cpu',
        proxyToWorker: false,
        debug: true,
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(99, Math.round((current / total) * 100))
            setProgressPct(pct)
            setProgressLabel(total > 10_000 && current < total ? `Descargando modelo… ${pct}%` : `Procesando… ${pct}%`)
          }
        },
      })

      const resultUrl = URL.createObjectURL(result)
      procUrlRef.current = resultUrl
      setProcessedBlob(result)
      setProcessedUrl(resultUrl)
      setCrop({ x: 0, y: 0, w: 1, h: 1 })
      setProgressPct(100)
      setStage('done')
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setError(`Error al procesar la imagen. Detalle: ${msg}`)
      setStage('error')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const handleSave = useCallback(async (mode: 'draft' | 'pending') => {
    if (!processedBlob && !processedUrl) return
    setIsSaving(true)
    setSaveMode(mode)
    setError(null)
    try {
      let composedBlob: Blob
      if (selectedTemplate && processedUrl) {
        composedBlob = await composeWithTemplate(processedUrl, selectedTemplate.image_url, {
          transform: transform ?? undefined,
          crop,
          playerName: playerName.trim() || undefined,
          nameBand: selectedTemplate.name_band ?? undefined,
          clubName: clubName.trim() || undefined,
          clubBand: selectedTemplate.club_band ?? undefined,
          uniformUrl: withUniform ? (selectedUniform?.image_url ?? undefined) : undefined,
          uniformTransform: withUniform ? (uniformTransform ?? undefined) : undefined,
          uniformCrop: withUniform ? uniformCrop : undefined,
        })
      } else {
        composedBlob = processedBlob!
      }

      const path = `${albumId}/${slot.id}/${currentUserId}.png`
      const { error: storageErr } = await supabase.storage
        .from('stickers')
        .upload(path, composedBlob, { contentType: 'image/png', upsert: true })
      if (storageErr) throw storageErr

      const { data: { publicUrl } } = supabase.storage.from('stickers').getPublicUrl(path)

      let resultSticker: Sticker
      if (existingSticker) {
        const { data, error: dbErr } = await supabase
          .from('stickers')
          .update({ image_url: publicUrl, status: mode, rejection_reason: null })
          .eq('id', existingSticker.id)
          .select()
          .single()
        if (dbErr) throw dbErr
        resultSticker = data as Sticker
      } else {
        const { data, error: dbErr } = await supabase
          .from('stickers')
          .insert({ album_id: albumId, slot_id: slot.id, user_id: currentUserId, image_url: publicUrl, status: mode })
          .select()
          .single()
        if (dbErr) throw dbErr
        resultSticker = data as Sticker
      }

      onSave(resultSticker)
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message)
        : String(err)
      setError(`No se pudo guardar. Detalle: ${msg}`)
    } finally {
      setIsSaving(false)
      setSaveMode(null)
    }
  }, [processedBlob, processedUrl, selectedTemplate, transform, crop, playerName, clubName, selectedUniform, uniformTransform, uniformCrop, withUniform, albumId, slot, currentUserId, existingSticker, onSave])

  const handleReset = useCallback(() => {
    setStage('idle'); setOriginalUrl(null); setProcessedUrl(null); setProcessedBlob(null)
    setError(null); setProgressPct(0); setSelectedTemplate(null); setSelectedUniform(null)
    setWithUniform(true); setTransform(null); setCrop({ x: 0, y: 0, w: 1, h: 1 })
    setUniformTransform(null); setUniformCrop({ x: 0, y: 0, w: 1, h: 1 })
    setPlayerName(''); setClubName(''); setCameraError(null)
  }, [])

  const startStream = useCallback(async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    const constraint = deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: true }
    const stream = await navigator.mediaDevices.getUserMedia(constraint)
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    return stream
  }, [])

  const openCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await startStream()
      // Enumerate cameras after permission is granted (labels are available then)
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setCameras(videoDevices)
      // Identify which index is the current stream's track
      const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId
      const idx = videoDevices.findIndex(d => d.deviceId === currentId)
      setCameraIndex(idx >= 0 ? idx : 0)
      setShowCamera(true)
    } catch {
      setCameraError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }, [startStream])

  const switchCamera = useCallback(async () => {
    if (cameras.length < 2) return
    const next = (cameraIndex + 1) % cameras.length
    setCameraIndex(next)
    try {
      await startStream(cameras[next].deviceId)
    } catch {
      setCameraError('No se pudo cambiar la cámara.')
    }
  }, [cameras, cameraIndex, startStream])

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setShowCamera(false)
    setCameraError(null)
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    // Mirror horizontally to match the preview (scaleX(-1) on <video>)
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      closeCamera()
      processFile(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.95)
  }, [closeCamera, processFile])

  const isProcessing = stage === 'loading' || stage === 'processing'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-mundial-purple/10 text-mundial-purple/50 hover:text-mundial-purple transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <p className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-mundial-purple/40">Editando sticker</p>
          {!hideSlotLabel && (
            <h3 className="font-display text-lg tracking-wide uppercase text-mundial-purple">
              Slot {slot.slot_number}{slot.label ? ` · ${slot.label}` : ''}
            </h3>
          )}
        </div>
      </div>

      {/* Existing sticker context (if any) */}
      {existingSticker && (
        <div className={[
          'flex items-start gap-3 px-4 py-3 rounded-xl border',
          existingSticker.status === 'rejected'
            ? 'bg-mundial-red/5 border-mundial-red/20'
            : 'bg-mundial-yellow/5 border-mundial-yellow/30',
        ].join(' ')}>
          <img src={existingSticker.image_url} alt="" className="w-16 h-20 object-contain rounded-lg border border-mundial-purple/10 bg-white shrink-0" />
          <div className="min-w-0">
            <p className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-mundial-purple/50">Sticker actual</p>
            {existingSticker.rejection_reason && (
              <p className="text-xs text-mundial-red mt-1">
                <span className="font-bold">Rechazado:</span> {existingSticker.rejection_reason}
              </p>
            )}
            <p className="text-xs text-mundial-purple/50 mt-1">Subí una nueva foto para reemplazarlo.</p>
          </div>
        </div>
      )}

      {/* Drop zone / Camera */}
      {(stage === 'idle' || stage === 'error') && (
        <>
          {/* Camera live view */}
          {showCamera && (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white border-4 border-mundial-yellow shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                  title="Capturar foto"
                >
                  <div className="w-10 h-10 rounded-full bg-mundial-yellow" />
                </button>
              </div>
              {/* Switch camera — only when multiple devices available */}
              {cameras.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="absolute bottom-6 right-4 p-2.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                  title="Cambiar cámara"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              )}
              <button
                onClick={closeCamera}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/50 text-white/80 hover:text-white text-xs font-display uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* File picker + camera cards */}
          {!showCamera && (
            <div className={hasCameraSupport ? 'grid grid-cols-2 gap-3' : ''}>
              {/* Gallery card */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 select-none outline-none flex flex-col items-center justify-center gap-2',
                  hasCameraSupport ? 'p-6' : 'p-8',
                  isDragging
                    ? 'border-mundial-green bg-mundial-green/10 scale-[1.01]'
                    : 'border-mundial-purple/20 bg-white/50 hover:border-mundial-green hover:bg-mundial-green/5',
                ].join(' ')}
              >
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                <div className={`rounded-2xl bg-gradient-to-br from-mundial-yellow to-mundial-yellow-dark flex items-center justify-center shadow ${hasCameraSupport ? 'w-12 h-12' : 'w-14 h-14 mb-2'}`}>
                  <svg className={hasCameraSupport ? 'w-6 h-6 text-mundial-purple' : 'w-7 h-7 text-mundial-purple'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                {hasCameraSupport ? (
                  <>
                    <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">Subí tu foto</p>
                    <p className="text-[11px] text-mundial-purple/50">JPG / PNG / WEBP</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-xl tracking-wide uppercase text-mundial-purple">Subí tu foto</p>
                    <p className="text-sm text-mundial-purple/60 mt-1">Arrastrá o hacé click · JPG / PNG / WEBP · Máx 10 MB</p>
                  </>
                )}
              </div>

              {/* Camera card */}
              {hasCameraSupport && (
                <div
                  onClick={openCamera}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openCamera()}
                  className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 select-none outline-none flex flex-col items-center justify-center gap-2 border-mundial-purple/20 bg-white/50 hover:border-mundial-turquoise hover:bg-mundial-turquoise/5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-mundial-turquoise to-mundial-green flex items-center justify-center shadow">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                  <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">Tomar foto</p>
                  <p className="text-[11px] text-mundial-purple/50">Cámara del dispositivo</p>
                </div>
              )}
            </div>
          )}

          {/* Camera permission error */}
          {cameraError && (
            <div className="flex items-start gap-2 text-sm text-mundial-red bg-mundial-red/10 border border-mundial-red/30 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {cameraError}
            </div>
          )}
        </>
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

      {/* Processing */}
      {isProcessing && (
        <div className="bg-mundial-cream/50 rounded-2xl border-2 border-mundial-green/20 p-8 text-center space-y-4">
          {originalUrl && (
            <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden border-2 border-mundial-yellow shadow">
              <img src={originalUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="w-9 h-9 mx-auto relative">
            <div className="absolute inset-0 rounded-full border-4 border-mundial-green/20" />
            <div className="absolute inset-0 rounded-full border-4 border-mundial-green border-t-transparent animate-spin" />
          </div>
          <p className="font-display text-base tracking-wide uppercase text-mundial-purple">{progressLabel}</p>
          {progressPct > 0 && (
            <div className="w-48 mx-auto">
              <div className="h-2 bg-mundial-purple/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-mundial-green to-mundial-turquoise rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-mundial-purple/60 mt-1">{progressPct}%</p>
            </div>
          )}
          {stage === 'loading' && (
            <p className="text-xs text-mundial-purple/50 max-w-xs mx-auto">La primera vez descarga el modelo de IA (~50 MB). Las siguientes serán más rápidas.</p>
          )}
        </div>
      )}

      {/* Done — composition + actions */}
      {stage === 'done' && originalUrl && processedUrl && (
        <div className="space-y-5">
          {/* Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-display text-xs text-mundial-purple/60 uppercase tracking-[0.2em] mb-2">Original</p>
              <div className="rounded-2xl overflow-hidden border-2 border-mundial-purple/10 bg-mundial-cream aspect-square">
                <img src={originalUrl} alt="Original" className="w-full h-full object-contain" />
              </div>
            </div>
            <div>
              <p className="font-display text-xs text-mundial-purple/60 uppercase tracking-[0.2em] mb-2">
                {selectedTemplate ? `Con: ${selectedTemplate.name}` : 'Sin fondo'}
              </p>
              {selectedTemplate && transform && processedUrl ? (
                <>
                  <CompositionEditor
                    templateUrl={selectedTemplate.image_url}
                    cutoutUrl={processedUrl}
                    transform={transform}
                    onTransformChange={setTransform}
                    crop={crop}
                    onCropChange={setCrop}
                    playerName={playerName}
                    nameBand={selectedTemplate.name_band}
                    clubName={clubName}
                    clubBand={selectedTemplate.club_band}
                    uniformUrl={withUniform ? selectedUniform?.image_url : undefined}
                    uniformTransform={withUniform ? (uniformTransform ?? undefined) : undefined}
                    onUniformTransformChange={setUniformTransform}
                    uniformCrop={withUniform ? uniformCrop : undefined}
                    onUniformCropChange={setUniformCrop}
                  />
                  <div className="mt-1 text-[10px] font-semibold text-mundial-purple/50 text-center">
                    Arrastrá para mover · handles blancos para recortar · círculo amarillo para escalar
                  </div>
                </>
              ) : (
                <div className="rounded-2xl overflow-hidden border-2 border-mundial-purple/10 bg-checkerboard aspect-square">
                  <img src={processedUrl} alt="Sin fondo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          </div>

          {/* Template picker */}
          <TemplatePicker selectedId={selectedTemplate?.id ?? null} onSelect={setSelectedTemplate} />

          {/* Toggle uniforme */}
          {selectedTemplate && selectedUniform && (
            <label htmlFor="se-with-uniform" className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input id="se-with-uniform" type="checkbox" className="peer sr-only" checked={withUniform} onChange={(e) => setWithUniform(e.target.checked)} />
                <div className="w-10 h-5 rounded-full border-2 border-mundial-purple/20 bg-mundial-purple/10 peer-checked:bg-mundial-green peer-checked:border-mundial-green transition-all" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="font-display text-sm text-mundial-purple/80 uppercase tracking-[0.15em]">Con uniforme</span>
            </label>
          )}

          {/* Nombre / Club */}
          {(selectedTemplate?.name_band || selectedTemplate?.club_band) && (
            <div className="space-y-3">
              {selectedTemplate?.name_band && (
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/60 uppercase tracking-[0.15em]">Tu nombre en el sticker</label>
                  <input
                    type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej: VALENCIA" maxLength={20}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-mundial-purple/20 bg-white/70 font-display text-mundial-purple placeholder:text-mundial-purple/30 uppercase tracking-wider focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>
              )}
              {selectedTemplate?.club_band && (
                <div className="space-y-1.5">
                  <label className="block font-display text-xs text-mundial-purple/60 uppercase tracking-[0.15em]">Tu club</label>
                  <input
                    type="text" value={clubName} onChange={(e) => setClubName(e.target.value)}
                    placeholder="Ej: BOCA JUNIORS" maxLength={25}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-mundial-purple/20 bg-white/70 font-display text-mundial-purple placeholder:text-mundial-purple/30 uppercase tracking-wider focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => handleSave('draft')}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-mundial-cream disabled:opacity-60 text-mundial-purple font-display text-sm tracking-wider uppercase rounded-xl border-2 border-mundial-purple/20 hover:border-mundial-purple/40 transition-colors"
            >
              {isSaving && saveMode === 'draft' ? (
                <div className="w-4 h-4 border-2 border-mundial-purple/30 border-t-mundial-purple rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              )}
              Guardar borrador
            </button>

            <button
              onClick={() => handleSave('pending')}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-60 text-white font-display text-sm tracking-wider uppercase rounded-xl shadow transition-colors"
            >
              {isSaving && saveMode === 'pending' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
              Enviar a revisión
            </button>

            <button
              onClick={handleReset}
              className="px-4 py-3 text-mundial-purple/50 hover:text-mundial-purple font-display text-sm tracking-wider uppercase rounded-xl hover:bg-mundial-purple/5 transition-colors"
            >
              Otra foto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
