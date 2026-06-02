import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const svcHeaders = {
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Content-Type': 'application/json',
}

export async function POST(req: NextRequest) {
  const { email, campaignIds } = await req.json() as { email: string; campaignIds?: string[] }

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  // 1. Invitar usuario via Supabase Admin API (envía email con link de configuración)
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/invite`, {
    method: 'POST',
    headers: svcHeaders,
    body: JSON.stringify({ email: email.trim() }),
  })

  if (!inviteRes.ok) {
    const err = await inviteRes.json()
    return NextResponse.json({ error: err.msg ?? err.message ?? 'Error al invitar' }, { status: 400 })
  }

  const newUser = await inviteRes.json()
  const userId: string = newUser.id

  // 2. Crear/actualizar perfil con role='organizer'
  // Upsert: si el trigger ya creó el perfil, actualiza el rol; si no, lo crea
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...svcHeaders, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id:  userId,
      username: email.trim().split('@')[0],
      role:     'organizer',
    }),
  })

  // 3. Asignar a campañas si se especificaron
  if (campaignIds && campaignIds.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/album_members`, {
      method: 'POST',
      headers: { ...svcHeaders, 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify(
        campaignIds.map(albumId => ({
          album_id:  albumId,
          user_id:   userId,
          role:      'admin',
          added_by:  null,
        }))
      ),
    })
  }

  return NextResponse.json({ success: true })
}
