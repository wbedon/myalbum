import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const sb = adminClient()

  const { data: profiles, error } = await sb
    .from('profiles')
    .select('user_id, username, role, must_change_password, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 200 })
  const authMap: Record<string, { email: string; last_sign_in_at: string | null }> = {}
  for (const u of (users ?? [])) {
    authMap[u.id] = { email: u.email ?? '—', last_sign_in_at: u.last_sign_in_at ?? null }
  }

  type ProfileRow = { user_id: string; username: string; role: string; must_change_password: boolean; created_at: string }
  return NextResponse.json(
    (profiles as ProfileRow[] ?? []).map(p => ({
      user_id:              p.user_id,
      username:             p.username,
      role:                 p.role,
      must_change_password: p.must_change_password ?? false,
      created_at:           p.created_at,
      email:                authMap[p.user_id]?.email ?? '—',
      last_sign_in_at:      authMap[p.user_id]?.last_sign_in_at ?? null,
    }))
  )
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { userId: string; role?: string; must_change_password?: boolean }
  const sb = adminClient()

  const updates: Record<string, unknown> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.must_change_password !== undefined) updates.must_change_password = body.must_change_password

  const { error } = await sb.from('profiles').update(updates).eq('user_id', body.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json() as { userId: string }
  const sb = adminClient()

  await sb.auth.admin.deleteUser(userId)
  await sb.from('profiles').delete().eq('user_id', userId)
  await sb.from('album_members').delete().eq('user_id', userId)

  return NextResponse.json({ success: true })
}
