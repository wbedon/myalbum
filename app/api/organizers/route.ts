import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const svcHeaders = {
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY,
  'Content-Type': 'application/json',
}

export async function GET() {
  // Organizer profiles
  const pRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?role=eq.organizer&select=user_id,username,created_at`,
    { headers: svcHeaders }
  )
  const profiles: { user_id: string; username: string; created_at: string }[] = await pRes.json()

  // Auth users for emails
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: svcHeaders })
  const { users } = await uRes.json()
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email

  // Campaign assignments
  const result = await Promise.all(profiles.map(async p => {
    const amRes = await fetch(
      `${SUPABASE_URL}/rest/v1/album_members?user_id=eq.${p.user_id}&role=eq.admin&select=album_id,albums(id,name)`,
      { headers: svcHeaders }
    )
    const memberships: { album_id: string; albums: { id: string; name: string } }[] = await amRes.json()
    return {
      user_id:    p.user_id,
      username:   p.username,
      email:      emailMap[p.user_id] ?? '—',
      created_at: p.created_at,
      campaigns:  memberships.map(m => ({ id: m.album_id, name: m.albums?.name })),
    }
  }))

  return NextResponse.json(result)
}

export async function DELETE(req: Request) {
  const { userId } = await req.json() as { userId: string }

  // Revert role to 'user'
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: svcHeaders,
    body: JSON.stringify({ role: 'user' }),
  })

  return NextResponse.json({ success: true })
}
