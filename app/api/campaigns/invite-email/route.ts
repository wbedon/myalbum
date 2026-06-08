import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, buildCampaignInviteHtml } from '@/lib/email'

export const runtime = 'nodejs'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  const supabase = adminClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { email, albumId, joinUrl, campaignName } = await req.json() as {
    email: string; albumId: string; joinUrl: string; campaignName: string
  }

  if (!email?.trim() || !albumId || !joinUrl || !campaignName) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  // Verificar que el caller es admin del álbum
  const { data: membership } = await supabase
    .from('album_members')
    .select('role')
    .eq('album_id', albumId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const result = await sendEmail({
    to:      email.trim(),
    type:    'invite_participant',
    subject: `🎴 Te invitaron al álbum "${campaignName}" — MyAlbum`,
    html:    buildCampaignInviteHtml(campaignName, joinUrl),
  })

  if (!result.sent) {
    const msgs: Record<string, string> = {
      cooldown:        'Ya se envió una invitación a este email recientemente (cooldown 24h).',
      recipient_quota: 'Se alcanzó el límite de emails para este destinatario hoy.',
      global_quota:    'Se alcanzó el límite diario de emails.',
      smtp_error:      'Error al enviar. Intentá más tarde.',
    }
    return NextResponse.json({ error: msgs[result.reason ?? ''] ?? 'No se pudo enviar.' }, { status: 429 })
  }

  return NextResponse.json({ success: true })
}
