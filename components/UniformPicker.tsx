'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Uniform } from '@/lib/supabase'

const MOCK_UNIFORMS: Uniform[] = [
  {
    id: 'mock-uni-arg',
    name: 'Argentina',
    image_url: 'https://placehold.co/400x600/75AADB/75AADB.png?text=+',
    sort_order: 0,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-uni-bra',
    name: 'Brasil',
    image_url: 'https://placehold.co/400x600/009C3B/009C3B.png?text=+',
    sort_order: 1,
    is_active: true,
    created_at: '',
  },
  {
    id: 'mock-uni-ecu',
    name: 'Ecuador',
    image_url: 'https://placehold.co/400x600/FFD100/FFD100.png?text=+',
    sort_order: 2,
    is_active: true,
    created_at: '',
  },
]

const FLAG_MAP: Record<string, string> = {
  'Argentina': '🇦🇷',
  'Brasil':    '🇧🇷',
  'Colombia':  '🇨🇴',
  'Ecuador':   '🇪🇨',
  'Venezuela': '🇻🇪',
  'Uruguay':   '🇺🇾',
  'Chile':     '🇨🇱',
  'Peru':      '🇵🇪',
  'Bolivia':   '🇧🇴',
  'Paraguay':  '🇵🇾',
  'México':    '🇲🇽',
  'USA':       '🇺🇸',
  'Canadá':    '🇨🇦',
}

function flagFor(name: string): string {
  return FLAG_MAP[name] ?? '🌐'
}

interface Props {
  selectedId: string | null
  onSelect: (uniform: Uniform | null) => void
}

export default function UniformPicker({ selectedId, onSelect }: Props) {
  const [uniforms, setUniforms] = useState<Uniform[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUniforms() {
      if (!isSupabaseConfigured) {
        setUniforms(MOCK_UNIFORMS)
        setLoading(false)
        return
      }
      try {
        const { data, error } = await supabase
          .from('uniforms')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (!error && data && data.length > 0) {
          setUniforms(data as Uniform[])
        }
        // Si la tabla está vacía en producción, no mostramos nada
      } catch {
        // Silencioso: la sección simplemente no aparece
      } finally {
        setLoading(false)
      }
    }
    fetchUniforms()
  }, [])

  // No renderizar si no hay uniformes disponibles
  if (!loading && uniforms.length === 0) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    onSelect(value === '' ? null : (uniforms.find((u) => u.id === value) ?? null))
  }

  return (
    <div className="space-y-2">
      <p className="font-display text-sm text-mundial-purple uppercase tracking-[0.2em]">
        Elegí un uniforme
      </p>

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
            <option value="">Sin uniforme</option>
            {uniforms.map((u) => (
              <option key={u.id} value={u.id}>
                {flagFor(u.name)}  {u.name}
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
