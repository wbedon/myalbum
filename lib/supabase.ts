import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type SafeArea = {
  x: number
  y: number
  width: number
  height: number
}

export type NameBand = {
  x: number
  y: number
  width: number
  height: number
  color?: string
  font_size?: number
  uppercase?: boolean
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
  pack_size: number
}

export type AlbumMember = {
  album_id: string
  user_id: string
  role: 'admin' | 'member'
  added_by: string | null
  created_at: string
  username?: string
}

export type AlbumSlot = {
  id: string
  album_id: string
  slot_number: number
  label: string | null
  created_at: string
}

export type Invitation = {
  id: string
  album_id: string
  token: string
  created_by: string | null
  expires_at: string | null
  max_uses: number | null
  uses_count: number
  created_at: string
}
