import { createClient } from '@supabase/supabase-js'

// Valores placeholder cuando no hay .env.local — permiten que el build estático
// se complete. En producción debes configurar las variables reales en Vercel.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Zona donde debe ubicarse el cutout dentro de la plantilla.
 * Coordenadas normalizadas (0–1) relativas al tamaño de la plantilla.
 * Si no se define, el cutout cubre todo el canvas (comportamiento simple).
 */
export type SafeArea = {
  x: number       // 0 = izquierda, 1 = derecha
  y: number       // 0 = arriba,   1 = abajo
  width: number   // ancho en fracción
  height: number  // alto en fracción
}

export type Template = {
  id: string
  name: string
  image_url: string
  sort_order: number
  is_active: boolean
  created_at: string
  safe_area?: SafeArea
}

export type Photo = {
  id: string
  processed_url: string
  template_id: string | null
  name: string | null
  created_at: string
}
