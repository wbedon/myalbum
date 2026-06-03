import { NextResponse } from 'next/server'
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
  const supabase = adminClient()

  // Perfiles con rol organizer
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, username, created_at')
    .eq('role', 'organizer')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Emails via Admin API
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 200 })
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email ?? '—'

  // Campañas asignadas por organizador
  const result = await Promise.all((profiles ?? []).map(async (p: { user_id: string; username: string; created_at: string }) => {
    const { data: memberships } = await supabase
      .from('album_members')
      .select('album_id, albums(id, name)')
      .eq('user_id', p.user_id)
      .eq('role', 'admin')

    return {
      user_id:    p.user_id,
      username:   p.username,
      email:      emailMap[p.user_id] ?? '—',
      created_at: p.created_at,
      campaigns:  (memberships ?? []).map((m: { album_id: string; albums: { id: string; name: string } | null }) => ({
        id:   m.album_id,
        name: m.albums?.name ?? '',
      })),
    }
  }))

  return NextResponse.json(result)
}

export async function DELETE(req: Request) {
  const { userId, deleteAuth } = await req.json() as { userId: string; deleteAuth?: boolean }
  const supabase = adminClient()

  if (deleteAuth) {
    // Eliminar completamente: auth user, perfil y membresías
    await supabase.auth.admin.deleteUser(userId)
    await supabase.from('profiles').delete().eq('user_id', userId)
    await supabase.from('album_members').delete().eq('user_id', userId)
  } else {
    // Solo quitar el rol organizer
    await supabase.from('profiles').update({ role: 'user' }).eq('user_id', userId)
  }

  return NextResponse.json({ success: true })
}
