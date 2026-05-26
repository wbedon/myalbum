'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Template, type Uniform } from '@/lib/supabase'
import { composeWithTemplate, type Transform, type CropBox } from '@/lib/compose'
import TemplatePicker from './TemplatePicker'
import CompositionEditor from './CompositionEditor'

// Fallback local cuando Supabase no está configurado o la tabla está vacía
const LOCAL_UNIFORMS: Uniform[] = [
  { id: 'local-arg', name: 'Argentina', image_url: '/uniforms/argentina.png', sort_order: 0, is_active: true, created_at: '' },
  { id: 'local-bra', name: 'Brasil',    image_url: '/uniforms/brasil.png',    sort_order: 1, is_active: true, created_at: '' },
  { id: 'local-col', name: 'Colombia',  image_url: '/uniforms/colombia.png',  sort_order: 2, is_active: true, created_at: '' },
  { id: 'local-ecu', name: 'Ecuador',   image_url: '/uniforms/ecuador.png',   sort_order: 3, is_active: true, created_at: '' },
  { id: 'local-ven', name: 'Venezuela', image_url: '/uniforms/venezuela.png', sort_order: 4, is_active: true, created_at: '' },
]

// TODO(inpainting): modo "Fondo sin persona". Intentado con inpaint-web (no
// existe en npm). Plan B abierto: Hugging Face Inference API vía API route
// de Next.js. Ver notas en TODO.md.

type Stage = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface Props {
  onPhotoSaved?: () => void
}

export default function PhotoUploader({ onPhotoSaved }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedUniform, setSelectedUniform] = useState<Uniform | null>(null)
  const [availableUniforms, setAvailableUniforms] = useState<Uniform[]>([])
  const [withUniform, setWithUniform] = useState(true)
  const [transform, setTransform] = useState<Transform | null>(null)
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 })
  const [uniformTransform, setUniformTransform] = useState<Transform | null>(null)
  const [uniformCrop, setUniformCrop] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 })
  const [playerName, setPlayerName] = useState<string>('')
  const [clubName, setClubName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const origUrlRef = useRef<string | null>(null)
  const procUrlRef = useRef<string | null>(null)
  const transformRef = useRef<Transform | null>(null)

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
    return () => {
      if (origUrlRef.current) URL.revokeObjectURL(origUrlRef.current)
      if (procUrlRef.current) URL.revokeObjectURL(procUrlRef.current)
    }
  }, [])

  // Inicializa el transform cuando se elige una plantilla con safe_area.
  // Si no tiene safe_area, usamos valores por defecto (cubre toda la plantilla).
  useEffect(() => {
    if (!selectedTemplate) {
      setTransform(null)
      return
    }
    const sa = selectedTemplate.safe_area
    setTransform(
      sa
        ? { x: sa.x, y: sa.y, width: sa.width }
        : { x: 0, y: 0, width: 1 }
    )
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
  }, [selectedTemplate])

  // Carga la lista de uniformes disponibles (una sola vez).
  useEffect(() => {
    if (!isSupabaseConfigured) { setAvailableUniforms(LOCAL_UNIFORMS); return }
    supabase
      .from('uniforms')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then((res: { data: unknown[] | null; error: unknown }) => {
        setAvailableUniforms(!res.error && res.data && res.data.length > 0 ? (res.data as Uniform[]) : LOCAL_UNIFORMS)
      })
      .catch(() => setAvailableUniforms(LOCAL_UNIFORMS))
  }, [])

  // Auto-selecciona el uniforme del mismo país que la plantilla elegida.
  useEffect(() => {
    if (!selectedTemplate || availableUniforms.length === 0) { setSelectedUniform(null); return }
    const match = availableUniforms.find(
      u => u.name.toLowerCase() === selectedTemplate.name.toLowerCase()
    )
    setSelectedUniform(match ?? null)
  }, [selectedTemplate, availableUniforms])

  // Mantiene la ref sincronizada para que el efecto de uniforme pueda leer el transform actual.
  useEffect(() => { transformRef.current = transform }, [transform])

  // Inicializa el transform del uniforme cuando se selecciona uno.
  // El offset vertical +0.30 posiciona la camiseta en el torso, no en la cabeza.
  useEffect(() => {
    if (!selectedUniform) {
      setUniformTransform(null)
      setUniformCrop({ x: 0, y: 0, w: 1, h: 1 })
      return
    }
    const t = transformRef.current
    setUniformTransform(
      t
        ? { x: t.x, y: t.y + 0.30, width: t.width }
        : { x: 0.05, y: 0.35, width: 0.9 }
    )
    setUniformCrop({ x: 0, y: 0, w: 1, h: 1 })
  }, [selectedUniform])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor sube una imagen válida (JPG, PNG, WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no puede superar los 10 MB.')
      return
    }

    setError(null)
    setSavedOk(false)
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
      // Cargamos @imgly/background-removal directamente del CDN (esm.sh) para
      // evitar que webpack procese su dependencia onnxruntime-web — esa ruta
      // de empaquetado rompe la inicialización de WASM/ORT en el navegador.
      // El comentario /* webpackIgnore: true */ le dice a webpack que deje
      // pasar este import sin tocarlo: lo resuelve el navegador en runtime.
      // @ts-ignore - dynamic import desde URL externa, sin tipos locales
      const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.7.0')
      const removeBackground = mod.removeBackground as (
        file: File,
        config?: {
          publicPath?: string
          model?: 'small' | 'medium' | 'large'
          device?: 'cpu' | 'gpu'
          proxyToWorker?: boolean
          debug?: boolean
          progress?: (key: string, current: number, total: number) => void
        }
      ) => Promise<Blob>

      setStage('processing')
      setProgressLabel('Eliminando fondo…')

      // publicPath explícito: webpack rompe el `import.meta.url` que la librería
      // usa internamente para localizar sus modelos. Apuntando al CDN oficial
      // de imgly evitamos el "TypeError: url.replace is not a function".
      // Importante: la versión del CDN debe coincidir con la versión instalada
      // del paquete (ver package.json), de lo contrario fallan los hashes.
      const result = await removeBackground(file, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        model: 'medium',         // isnet512 (~40MB, mejor calidad de bordes)
        device: 'cpu',           // evita rutas WebGPU experimentales
        proxyToWorker: false,    // evita problemas de Web Worker en Next dev
        debug: true,             // imprime info detallada en la consola
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(99, Math.round((current / total) * 100))
            setProgressPct(pct)
            const isDownload = total > 10_000 && current < total
            setProgressLabel(
              isDownload ? `Descargando modelo… ${pct}%` : `Procesando imagen… ${pct}%`
            )
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
      console.error('[MyAlbum] Background removal failed:', err)
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setError(`Error al procesar la imagen. Detalle: ${msg}`)
      setStage('error')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ''
    },
    [processFile]
  )

  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!processedBlob || !processedUrl) return
    setIsDownloading(true)
    try {
      let blob: Blob
      if (selectedTemplate) {
        blob = await composeWithTemplate(processedUrl, selectedTemplate.image_url, {
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
        blob = processedBlob
      }

      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = selectedTemplate ? 'foto-con-fondo.png' : 'foto-sin-fondo.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[MyAlbum] Download compose failed:', err)
      setError('No se pudo generar la imagen final.')
    } finally {
      setIsDownloading(false)
    }
  }, [processedBlob, processedUrl, selectedTemplate, transform, crop, playerName, clubName, selectedUniform, uniformTransform, uniformCrop, withUniform])

  const handleSave = useCallback(async () => {
    if (!processedBlob) return
    setIsSaving(true)
    setError(null)
    try {
      const id = crypto.randomUUID()
      const path = `processed/${id}.png`

      const { error: storageErr } = await supabase.storage
        .from('photos')
        .upload(path, processedBlob, { contentType: 'image/png' })
      if (storageErr) throw storageErr

      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(path)

      // Si el ID de plantilla es un mock (no es UUID real), no lo enviamos
      const isRealTemplateId =
        selectedTemplate?.id && !selectedTemplate.id.startsWith('mock-')

      const { error: dbErr } = await supabase.from('photos').insert({
        id,
        processed_url: publicUrl,
        template_id: isRealTemplateId ? selectedTemplate!.id : null,
      })
      if (dbErr) throw dbErr

      setSavedOk(true)
      onPhotoSaved?.()
    } catch (err) {
      console.error('[MyAlbum] Save failed:', err)
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      setError(`No se pudo guardar. Detalle: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }, [processedBlob, onPhotoSaved, selectedTemplate])

  const handleReset = useCallback(() => {
    setStage('idle')
    setOriginalUrl(null)
    setProcessedUrl(null)
    setProcessedBlob(null)
    setError(null)
    setSavedOk(false)
    setProgressPct(0)
    setSelectedTemplate(null)
    setSelectedUniform(null)
    setWithUniform(true)
    setTransform(null)
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
    setUniformTransform(null)
    setUniformCrop({ x: 0, y: 0, w: 1, h: 1 })
    setPlayerName('')
    setClubName('')
  }, [])

  const isProcessing = stage === 'loading' || stage === 'processing'

  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      {(stage === 'idle' || stage === 'error') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className={[
            'group border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer',
            'transition-all duration-300 select-none outline-none relative overflow-hidden',
            'focus-visible:ring-4 focus-visible:ring-mundial-green/30',
            isDragging
              ? 'border-mundial-green bg-mundial-green/10 scale-[1.02] shadow-2xl shadow-mundial-green/20'
              : 'border-mundial-purple/20 bg-white/50 hover:border-mundial-green hover:bg-mundial-green/5 hover:shadow-xl hover:shadow-mundial-green/10',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Icon con glow */}
          <div className="relative inline-block mb-5">
            {/* Glow detrás del ícono */}
            <div
              className={[
                'absolute inset-0 rounded-2xl blur-2xl transition-all duration-500',
                isDragging ? 'bg-mundial-yellow/60 scale-150' : 'bg-mundial-yellow/30 scale-100 group-hover:scale-125 group-hover:bg-mundial-yellow/50',
              ].join(' ')}
            />
            <div
              className={[
                'relative mx-auto w-20 h-20 rounded-2xl flex items-center justify-center transition-transform duration-300 shadow-lg',
                'bg-gradient-to-br from-mundial-yellow to-mundial-yellow-dark',
                isDragging ? 'scale-110 rotate-6' : 'group-hover:scale-105 group-hover:rotate-3',
              ].join(' ')}
            >
              <svg
                className="w-10 h-10 text-mundial-purple"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
            </div>
          </div>

          <p className="font-display text-3xl sm:text-4xl tracking-wide uppercase text-mundial-purple">
            {isDragging ? 'Soltá la foto aquí' : 'Subí tu foto'}
          </p>
          <p className="text-sm sm:text-base text-mundial-purple/70 mt-2 font-condensed font-medium">
            Arrastrá una imagen o hacé click para seleccionar
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 bg-mundial-purple/5 rounded-full">
            <span className="text-[10px] text-mundial-purple/60 font-condensed font-bold tracking-[0.2em] uppercase">
              JPG · PNG · WEBP · Máx 10 MB
            </span>
          </div>

          {isMobile && (
            <p className="inline-block text-xs font-semibold text-mundial-red bg-mundial-yellow/40 border border-mundial-yellow rounded-lg px-3 py-1.5 mt-4">
              En móvil el procesamiento puede tardar 20–40 seg
            </p>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-mundial-red bg-mundial-red/10 border border-mundial-red/30 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="bg-mundial-cream/50 rounded-2xl border-2 border-mundial-green/20 p-10 text-center space-y-4">
          {originalUrl && (
            <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden border-2 border-mundial-yellow shadow-md">
              <img src={originalUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Spinner */}
          <div className="w-10 h-10 mx-auto relative">
            <div className="absolute inset-0 rounded-full border-4 border-mundial-green/20" />
            <div className="absolute inset-0 rounded-full border-4 border-mundial-green border-t-transparent animate-spin" />
          </div>

          <p className="font-display text-lg tracking-wide uppercase text-mundial-purple">
            {progressLabel}
          </p>

          {progressPct > 0 && (
            <div className="w-56 mx-auto">
              <div className="h-2 bg-mundial-purple/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-mundial-green to-mundial-turquoise rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-mundial-purple/60 mt-1 font-semibold">{progressPct}%</p>
            </div>
          )}

          {stage === 'loading' && (
            <p className="text-xs text-mundial-purple/60 max-w-xs mx-auto">
              La primera vez descarga el modelo de IA (~50 MB). Las siguientes serán más rápidas.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {stage === 'done' && originalUrl && processedUrl && (
        <div className="space-y-5">
          {/* Before / After */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-display text-sm text-mundial-purple/70 uppercase tracking-[0.2em] mb-2">
                Original
              </p>
              <div className="rounded-2xl overflow-hidden border-2 border-mundial-purple/10 bg-mundial-cream aspect-square">
                <img
                  src={originalUrl}
                  alt="Foto original"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div>
              <p className="font-display text-sm text-mundial-purple/70 uppercase tracking-[0.2em] mb-2">
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
                  <div className="mt-1.5 text-[10px] font-semibold text-mundial-purple/60 text-center">
                    Arrastrá para mover · handles blancos para recortar · círculo amarillo para redimensionar
                  </div>
                </>
              ) : (
                <div className="rounded-2xl overflow-hidden border-2 border-mundial-purple/10 bg-checkerboard aspect-square">
                  <img
                    src={processedUrl}
                    alt="Resultado"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Template picker */}
          <TemplatePicker
            selectedId={selectedTemplate?.id ?? null}
            onSelect={setSelectedTemplate}
          />

          {/* Toggle uniforme — solo cuando la plantilla tiene uniforme disponible */}
          {selectedTemplate && selectedUniform && (
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div className="relative">
                <input
                  id="with-uniform"
                  type="checkbox"
                  className="peer sr-only"
                  checked={withUniform}
                  onChange={(e) => setWithUniform(e.target.checked)}
                />
                <div className="w-11 h-6 rounded-full border-2 border-mundial-purple/20 bg-mundial-purple/10 peer-checked:bg-mundial-green peer-checked:border-mundial-green transition-all duration-200" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 peer-checked:translate-x-5" />
              </div>
              <span className="font-display text-sm text-mundial-purple/80 uppercase tracking-[0.15em]">
                Con uniforme
              </span>
            </label>
          )}

          {/* Campos de nombre — solo aparecen si la plantilla tiene bandas */}
          {(selectedTemplate?.name_band || selectedTemplate?.club_band) && (
            <div className="space-y-3">
              {selectedTemplate?.name_band && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="player-name"
                    className="block font-display text-sm text-mundial-purple/70 uppercase tracking-[0.15em]"
                  >
                    Tu nombre en el sticker
                  </label>
                  <input
                    id="player-name"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej: VALENCIA"
                    maxLength={20}
                    className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 font-display text-mundial-purple placeholder:text-mundial-purple/30 text-base tracking-wider uppercase focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>
              )}
              {selectedTemplate?.club_band && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="club-name"
                    className="block font-display text-sm text-mundial-purple/70 uppercase tracking-[0.15em]"
                  >
                    Tu club
                  </label>
                  <input
                    id="club-name"
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Ej: BOCA JUNIORS"
                    maxLength={25}
                    className="w-full px-4 py-3 rounded-xl border-2 border-mundial-purple/20 bg-white/70 font-display text-mundial-purple placeholder:text-mundial-purple/30 text-base tracking-wider uppercase focus:outline-none focus:border-mundial-green focus:ring-2 focus:ring-mundial-green/20 transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center pt-1">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-mundial-red to-mundial-red-dark disabled:from-mundial-purple/30 disabled:to-mundial-purple/30 text-white font-display text-base tracking-wider uppercase rounded-xl btn-glow-red disabled:cursor-not-allowed disabled:transform-none"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Descargar PNG
            </button>

            {!isSupabaseConfigured ? null : !savedOk ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-mundial-green font-display text-base tracking-wider uppercase rounded-xl border-2 border-mundial-green btn-glow-green disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-mundial-green/30 border-t-mundial-green rounded-full animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                      />
                    </svg>
                    Guardar en álbum
                  </>
                )}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-mundial-green/15 to-mundial-turquoise/15 text-mundial-green font-display text-base tracking-wider uppercase rounded-xl border-2 border-mundial-green/40">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Guardado en álbum
              </span>
            )}

            <button
              onClick={handleReset}
              className="px-6 py-3 text-mundial-purple/60 hover:text-mundial-purple font-display text-base tracking-wider uppercase rounded-xl hover:bg-mundial-purple/5 transition-colors"
            >
              Otra foto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
