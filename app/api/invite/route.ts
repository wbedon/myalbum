import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const APP_URL = 'https://myalbum-green.vercel.app'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function buildInviteHtml(actionLink: string, campaigns: string[]): string {
  const campaignList = campaigns.length > 0
    ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
         Vas a gestionar ${campaigns.length === 1 ? 'la campaña' : 'las campañas'}:
         <strong>${campaigns.join(', ')}</strong>.
       </p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px;">
            <h1 style="margin:0;color:#f59e0b;font-family:sans-serif;font-size:20px;font-weight:700;">MyAlbum</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:sans-serif;">
            <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">¡Te invitaron como organizador!</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Fuiste invitado a gestionar campañas en <strong>MyAlbum</strong>,
              el álbum de figuritas digital del Mundial 2026.
            </p>
            ${campaignList}
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Hacé click en el botón para configurar tu contraseña y comenzar.
            </p>
            <a href="${actionLink}"
               style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-family:sans-serif;font-size:15px;">
              Configurar contraseña
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
              Si no esperabas esta invitación, podés ignorar este correo.
              El link expira en 24 horas.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-family:sans-serif;font-size:12px;color:#9ca3af;">
              MyAlbum — Álbum de figuritas digital
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const { email, campaignIds, campaignNames } = await req.json() as {
    email: string
    campaignIds?: string[]
    campaignNames?: string[]
  }

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const supabase = adminClient()

  // 1. Generar link de invitación sin que Supabase envíe email
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email.trim(),
    options: { redirectTo: APP_URL },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const userId     = data.user.id
  const actionLink = data.properties.action_link

  // 2. Upsert perfil con role='organizer'
  await supabase.from('profiles').upsert({
    user_id:  userId,
    username: email.trim().split('@')[0],
    role:     'organizer',
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

  // 4. Enviar email personalizado via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    'MyAlbum <onboarding@resend.dev>',
    to:      email.trim(),
    subject: '🎉 Te invitaron a organizar en MyAlbum',
    html:    buildInviteHtml(actionLink, campaignNames ?? []),
  })

  return NextResponse.json({ success: true })
}
