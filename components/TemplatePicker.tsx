'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Template } from '@/lib/supabase'

const MOCK_TEMPLATES: Template[] = [
  {
    id: 'mock-figura',
    name: 'Figura original',
    image_url: '/templates/figura.jpg',
    sort_order: 0,
    is_active: true,
    created_at: '',
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
]

const FLAG_MAP: Record<string, string> = {
  'Argentina':  '🇦🇷',
  'Brasil':     '🇧🇷',
  'Colombia':   '🇨🇴',
  'Ecuador':    '🇪🇨',
  'Venezuela':  '🇻🇪',
  'Uruguay':    '🇺🇾',
  'Chile':      '🇨🇱',
  'Peru':       '🇵🇪',
  'Bolivia':    '🇧🇴',
  'Paraguay':   '🇵🇾',
  'México':     '🇲🇽',
  'USA':        '🇺🇸',
  'Canadá':     '🇨🇦',
}

function flagFor(name: string): string {
  return FLAG_MAP[name] ?? '🌐'
}

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

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '') {
      onSelect(null)
    } else {
      onSelect(templates.find((t) => t.id === value) ?? null)
    }
  }

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

      {loading ? (
        <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="relative">
          <select
            value={selectedId ?? ''}
            onChange={handleChange}
            className={[
              'w-full px-4 py-3 pr-10 rounded-xl border-2 bg-white/70',
              'font-display text-mundial-purple text-base',
              'appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-mundial-green/20 transition-colors',
              selectedId !== null
                ? 'border-mundial-green'
                : 'border-mundial-purple/20 hover:border-mundial-green/50',
            ].join(' ')}
          >
            <option value="">Sin fondo</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {flagFor(t.name)}  {t.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              className="w-4 h-4 text-mundial-purple/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
