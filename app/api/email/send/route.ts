import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Payload = Record<string, unknown>

const SUBJECTS: Record<string, string> = {
  sticker_approved: '✅ Tu cromo fue aprobado',
  sticker_rejected: '❌ Tu cromo fue rechazado',
  trade_requested:  '🔄 Solicitud de intercambio recibida',
  trade_accepted:   '🎉 Tu intercambio fue aceptado',
  pack_available:   '📦 Tienes sobres nuevos disponibles',
}

function buildHtml(type: string, payload: Payload): string {
  const APP_URL = 'https://myalbum-green.vercel.app'

  const slot = payload.slot_label
    ? `${payload.slot_label} (#${payload.slot_number})`
    : `#${payload.slot_number}`

  const bodies: Record<string, string> = {
    sticker_approved:
      `¡Tu cromo para el slot <strong>${slot}</strong> fue aprobado y ya está visible en el álbum!`,
    sticker_rejected:
      `Tu cromo para el slot <strong>${slot}</strong> fue rechazado` +
      (payload.rejection_reason ? `: <em>${payload.rejection_reason}</em>` : '.') +
      ' Podés enviar uno nuevo desde la app.',
    trade_requested:
      `<strong>${payload.requester_username}</strong> quiere intercambiar su cromo ` +
      `<strong>${payload.req_slot_label || '#' + payload.req_slot_number}</strong> por ` +
      `tu cromo <strong>${payload.offer_slot_label || '#' + payload.offer_slot_number}</strong>. ` +
      `Revisá la propuesta en la app.`,
    trade_accepted:
      `<strong>${payload.offerer_username}</strong> aceptó tu solicitud. ` +
      `Ya tenés el cromo <strong>${payload.got_slot_label || '#' + payload.got_slot_number}</strong> en tu colección.`,
    pack_available:
      `Hay un sobre con <strong>${payload.pack_size} cromo${Number(payload.pack_size) !== 1 ? 's' : ''}</strong> esperándote. ¡Ábrelo ahora!`,
  }

  const body = bodies[type] ?? 'Tenés una nueva notificación en MyAlbum.'

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
            <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.7;">${body}</p>
            <a href="${APP_URL}"
               style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-family:sans-serif;font-size:15px;">
              Abrir app
            </a>
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
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.PUSH_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { user_id, type, payload } = await req.json() as {
      user_id: string
      type: string
      payload: Payload
    }

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data: { user }, error: userError } =
      await supabase.auth.admin.getUserById(user_id)

    if (userError || !user?.email) return NextResponse.json({ ok: true, sent: 0 })

    await resend.emails.send({
      from: 'MyAlbum <onboarding@resend.dev>',
      to:      user.email,
      subject: SUBJECTS[type] ?? '🔔 Nueva notificación en MyAlbum',
      html:    buildHtml(type, payload ?? {}),
    })

    return NextResponse.json({ ok: true, sent: 1 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
