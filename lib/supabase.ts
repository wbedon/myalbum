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

/**
 * Región de la plantilla donde se superpone el nombre del jugador.
 * Coordenadas normalizadas (0–1). Configurado por plantilla en Supabase.
 */
export type NameBand = {
  x: number           // fracción 0–1
  y: number           // fracción 0–1
  width: number       // fracción 0–1
  height: number      // fracción 0–1
  color?: string      // color del texto (default '#FFFFFF')
  font_size?: number  // fracción del ancho del canvas (default 0.055)
  uppercase?: boolean // default true
}

export type Template = {
  id: string
  name: string
  image_url: string
  sort_order: number
  is_active: boolean
  created_at: string
  safe_area?: SafeArea
  name_band?: NameBand
  club_band?: NameBand
}

export type Uniform = {
  id: string
  name: string
  image_url: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export type Photo = {
  id: string
  processed_url: string
  template_id: string | null
  name: string | null
  created_at: string
}

export type Profile = {
  user_id: string
  username: string | null
  role: 'user' | 'superadmin'
  created_at: string
}

export type Album = {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
}

export type AlbumMember = {
  album_id: string
  user_id: string
  role: 'admin' | 'member'
  added_by: string | null
  created_at: string
  username?: string
}
