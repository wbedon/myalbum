import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const APP_URL = 'https://myalbum-green.vercel.app'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { email, role = 'organizer', campaignIds } = await req.json() as { email: string; role?: string; campaignIds?: string[] }

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const supabase = adminClient()

  // 1. Invitar usuario — Supabase envía el email usando el template personalizado del dashboard
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: APP_URL,
  })
  if (error) {
    const msg = error.message.toLowerCase().includes('already been registered')
      ? 'Este email ya tiene una invitación pendiente o una cuenta activa.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const userId = data.user.id

  // 2. Upsert perfil con el rol indicado
  await supabase.from('profiles').upsert({
    user_id:              userId,
    username:             email.trim().split('@')[0],
    role:                 role,
    must_change_password: true,
  }, { onConflict: 'user_id' })

  // 3. Asignar a campañas si se indicaron
  if (campaignIds && campaignIds.length > 0) {
    await supabase.from('album_members').upsert(
      campaignIds.map(albumId => ({
        album_id: albumId,
        user_id:  userId,
        role:     'admin',
        added_by: null,
      })),
      { onConflict: 'album_id,user_id', ignoreDuplicates: true }
    )
  }

  return NextResponse.json({ success: true })
}
