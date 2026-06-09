import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
  },
})

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
  uniform_url?: string
  sort_order: number
  is_active: boolean
  created_at: string
  safe_area?: SafeArea
  name_band?: NameBand
  club_band?: NameBand
}

export type CoverEdition = {
  id: string
  name: string
  portada_url: string
  contraportada_url: string
  sort_order: number
  is_active: boolean
  created_at: string
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
  role: 'user' | 'superadmin' | 'organizer'
  created_at: string
  must_change_password?: boolean
  profile_complete?: boolean
}

export type Album = {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  pack_size: number
  is_public: boolean
  cover_edition_id?: string | null
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
  assigned_user_id: string | null
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

export type StickerStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type Sticker = {
  id: string
  album_id: string
  slot_id: string
  user_id: string
  image_url: string
  status: StickerStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type TradeOffer = {
  id: string
  album_id: string
  offerer_id: string
  collection_id: string
  status: 'open' | 'matched' | 'cancelled'
  created_at: string
}

export type TradeRequest = {
  id: string
  offer_id: string
  requester_id: string
  collection_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export type Pack = {
  id: string
  album_id: string
  user_id: string
  status: 'sealed' | 'opened'
  opened_at: string | null
  created_at: string
}

export type CollectionItem = {
  id: string
  album_id: string
  user_id: string
  sticker_id: string
  pack_id: string | null
  created_at: string
}

export type ReactionEmoji = '❤️' | '🔥' | '⭐' | '😂'

export type StickerReaction = {
  id: string
  user_id: string
  sticker_id: string
  album_id: string
  emoji: ReactionEmoji
  created_at: string
}

export type AchievementType =
  | 'first_sticker_submitted'
  | 'first_sticker_approved'
  | 'sticker_approved_5'
  | 'first_pack_opened'
  | 'first_card_collected'
  | 'collector_10'
  | 'first_trade'
  | 'trader_5'
  | 'album_complete'

export type Achievement = {
  type: AchievementType
  earned_at: string
}

export type NotificationType =
  | 'sticker_approved'
  | 'sticker_rejected'
  | 'trade_requested'
  | 'trade_accepted'
  | 'pack_available'

export type Notification = {
  id: string
  user_id: string
  album_id: string
  type: NotificationType
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}
