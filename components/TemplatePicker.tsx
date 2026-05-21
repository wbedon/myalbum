'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Template } from '@/lib/supabase'

// Plantillas de demostración para cuando Supabase aún no está configurado.
// Mezcla colores sólidos (placehold.co), imágenes (picsum.photos) y SVG local
// para mostrar que la misma estructura soporta los tres casos sin código distinto.
const MOCK_TEMPLATES: Template[] = [
  {
    id: 'mock-figura',
    name: 'Figura original',
    image_url: '/templates/figura.jpg',
    sort_order: 0,
    is_active: true,
    created_at: '',
    // Galíndez en la imagen ocupa aprox. estas coordenadas normalizadas:
    // queda por encima de la banda morada del nombre y dentro del marco.
    safe_area: { x: 0.20, y: 0.05, width: 0.60, height: 0.78 },
  },
  {
    id: 'mock-blue',
    name: 'Azul carnet',
    image_url: 'https://placehold.co/600x800/1e3a8a/1e3a8a.jpg?text=+',
    sort_order: 1,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-white',
    name: 'Blanco',
    image_url: 'https://placehold.co/600x800/ffffff/ffffff.jpg?text=+',
    sort_order: 2,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-gray',
    name: 'Gris neutro',
    image_url: 'https://placehold.co/600x800/64748b/64748b.jpg?text=+',
    sort_order: 3,
    is_active: true,
    created_at: '',
  },
  // Plantillas tipo imagen (picsum.photos: imágenes aleatorias estables por seed)
  {
    id: 'mock-img-1',
    name: 'Naturaleza',
    image_url: 'https://picsum.photos/seed/naturaleza/600/800',
    sort_order: 4,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-img-2',
    name: 'Estudio',
    image_url: 'https://picsum.photos/seed/estudio/600/800',
    sort_order: 5,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-img-3',
    name: 'Oficina',
    image_url: 'https://picsum.photos/seed/oficina/600/800',
    sort_order: 6,
    is_active: true,
    created_at: '',
  },
]

interface Props {
  selectedId: string | null
  onSelect: (template: Template | null) => void
}

export default function TemplatePicker({ selectedId, onSelect }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [usingMocks, setUsingMocks] = useState(false)

  useEffect(() => {
    async function fetchTemplates() {
      if (!isSupabaseConfigured) {
        setTemplates(MOCK_TEMPLATES)
        setUsingMocks(true)
        setLoading(false)
        return
      }
      try {
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (!error && data && data.length > 0) {
          setTemplates(data as Template[])
        } else {
          setTemplates(MOCK_TEMPLATES)
          setUsingMocks(true)
        }
      } catch {
        setTemplates(MOCK_TEMPLATES)
        setUsingMocks(true)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm text-mundial-purple uppercase tracking-[0.2em]">
          Elegí un fondo
        </p>
        {usingMocks && (
          <p className="text-[10px] font-semibold text-mundial-red bg-mundial-yellow/30 px-2 py-0.5 rounded">
            Demo · configurá Supabase para tus plantillas
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {/* Opción "Sin fondo" (transparente) */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          title="Sin fondo"
          className={[
            'aspect-[3/4] rounded-lg border-2 bg-checkerboard transition-all overflow-hidden relative',
            'flex items-center justify-center',
            selectedId === null
              ? 'border-mundial-green ring-2 ring-mundial-green/30'
              : 'border-mundial-purple/15 hover:border-mundial-green/50',
          ].join(' ')}
        >
          <span className="text-[10px] text-slate-500 font-medium bg-white/80 px-1.5 py-0.5 rounded">
            Sin fondo
          </span>
        </button>

        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-lg bg-slate-100 animate-pulse"
              />
            ))
          : templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                title={t.name}
                className={[
                  'aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all relative',
                  selectedId === t.id
                    ? 'border-mundial-green ring-2 ring-mundial-green/30'
                    : 'border-mundial-purple/15 hover:border-mundial-green/50',
                ].join(' ')}
              >
                <img
                  src={t.image_url}
                  alt={t.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  loading="lazy"
                />
                <span className="absolute bottom-1 left-1 right-1 text-[9px] font-medium text-white bg-black/40 backdrop-blur-sm px-1 py-0.5 rounded truncate">
                  {t.name}
                </span>
              </button>
            ))}
      </div>
    </div>
  )
}
