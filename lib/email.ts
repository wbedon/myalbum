import { createClient } from '@supabase/supabase-js'

const DAILY_GLOBAL_LIMIT    = 280   // margen sobre el límite de Brevo (300/día)
const DAILY_RECIPIENT_LIMIT = 10    // máx emails/día por destinatario
const COOLDOWN_HOURS        = 2     // mín horas entre el mismo tipo de notif al mismo email
const INVITE_COOLDOWN_HOURS = 24    // cooldown mayor para invitaciones

const APP_URL = 'https://myalbum-green.vercel.app'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const clean = (s: string) => s.replace(/^﻿/, '').trim()
  const apiKey     = clean(process.env.BREVO_API_KEY ?? '')
  const senderEmail = clean(process.env.BREVO_SENDER_EMAIL ?? 'rbedon1983@gmail.com')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'content-type': 'application/json',
      'api-key':      apiKey,
    },
    body: JSON.stringify({
      sender:      { name: 'MyAlbum', email: senderEmail },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo ${res.status}: ${body}`)
  }
}

export type EmailType =
  | 'sticker_approved' | 'sticker_rejected'
  | 'trade_requested'  | 'trade_accepted'
  | 'pack_available'
  | 'invite_organizer' | 'invite_user'
  | 'invite_participant'

export interface SendEmailParams {
  to:      string
  type:    EmailType
  subject: string
  html:    string
}

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  const sb       = adminClient()
  const now      = new Date()
  const sentDate = now.toISOString().slice(0, 10) // YYYY-MM-DD UTC
  const isInvite = params.type.startsWith('invite_')
  const cooldownCutoff = new Date(
    now.getTime() - (isInvite ? INVITE_COOLDOWN_HOURS : COOLDOWN_HOURS) * 3600 * 1000
  ).toISOString()

  // 1. Cuota global diaria
  const { count: globalCount } = await sb
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('sent_date', sentDate)
    .eq('blocked', false)

  if ((globalCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
    await sb.from('email_log').insert({ to_email: params.to, type: params.type, sent_date: sentDate, blocked: true, block_reason: 'global_quota' })
    console.warn(`[email] Cuota global alcanzada (${globalCount}/día) — bloqueado: ${params.to}`)
    return { sent: false, reason: 'global_quota' }
  }

  // 2. Cuota por destinatario
  const { count: recipientCount } = await sb
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('to_email', params.to)
    .eq('sent_date', sentDate)
    .eq('blocked', false)

  if ((recipientCount ?? 0) >= DAILY_RECIPIENT_LIMIT) {
    await sb.from('email_log').insert({ to_email: params.to, type: params.type, sent_date: sentDate, blocked: true, block_reason: 'recipient_quota' })
    return { sent: false, reason: 'recipient_quota' }
  }

  // 3. Cooldown: mismo tipo + mismo destinatario
  const { count: cooldownCount } = await sb
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('to_email', params.to)
    .eq('type', params.type)
    .eq('blocked', false)
    .gte('sent_at', cooldownCutoff)

  if ((cooldownCount ?? 0) > 0) {
    await sb.from('email_log').insert({ to_email: params.to, type: params.type, sent_date: sentDate, blocked: true, block_reason: 'cooldown' })
    return { sent: false, reason: 'cooldown' }
  }

  // 4. Enviar vía Brevo API
  try {
    await sendViaBrevo(params.to, params.subject, params.html)
    await sb.from('email_log').insert({ to_email: params.to, type: params.type, sent_date: sentDate, sent_at: now.toISOString(), blocked: false })
    return { sent: true }
  } catch (err) {
    console.error('[email] SMTP error:', err)
    await sb.from('email_log').insert({ to_email: params.to, type: params.type, sent_date: sentDate, blocked: true, block_reason: 'smtp_error' })
    return { sent: false, reason: 'smtp_error' }
  }
}

// ── Asuntos ───────────────────────────────────────────────────────────────────

export const NOTIFICATION_SUBJECTS: Record<string, string> = {
  sticker_approved: '✅ Tu sticker fue aprobado — MyAlbum',
  sticker_rejected: '❌ Tu sticker fue rechazado — MyAlbum',
  trade_requested:  '🔄 Solicitud de intercambio — MyAlbum',
  trade_accepted:   '🎉 Intercambio aceptado — MyAlbum',
  pack_available:   '📦 Tenés sobres nuevos — MyAlbum',
}

// ── HTML builders ─────────────────────────────────────────────────────────────

type Payload = Record<string, unknown>

export function buildNotificationHtml(type: string, payload: Payload): string {
  const slot = payload.slot_label
    ? `${payload.slot_label} (#${payload.slot_number})`
    : `#${payload.slot_number}`

  const bodies: Record<string, string> = {
    sticker_approved:
      `¡Tu sticker para el slot <strong>${slot}</strong> fue aprobado y ya está visible en el álbum!`,
    sticker_rejected:
      `Tu sticker para el slot <strong>${slot}</strong> fue rechazado` +
      (payload.rejection_reason ? `: <em>${payload.rejection_reason}</em>` : '.') +
      ' Podés enviar uno nuevo desde la app.',
    trade_requested:
      `<strong>${payload.requester_username}</strong> quiere intercambiar su sticker ` +
      `<strong>${payload.req_slot_label || '#' + payload.req_slot_number}</strong> por ` +
      `tu sticker <strong>${payload.offer_slot_label || '#' + payload.offer_slot_number}</strong>. ` +
      `Revisá la propuesta en la app.`,
    trade_accepted:
      `<strong>${payload.offerer_username}</strong> aceptó tu solicitud. ` +
      `Ya tenés el sticker <strong>${payload.got_slot_label || '#' + payload.got_slot_number}</strong> en tu colección.`,
    pack_available:
      `Hay un sobre con <strong>${payload.pack_size} sticker${Number(payload.pack_size) !== 1 ? 's' : ''}</strong> esperándote. ¡Ábrelo ahora!`,
  }

  return buildBaseHtml(bodies[type] ?? 'Tenés una nueva notificación en MyAlbum.', 'Abrir app', APP_URL)
}

export function buildCampaignInviteHtml(campaignName: string, joinUrl: string, tempPassword?: string): string {
  const body = tempPassword
    ? `Fuiste invitado a participar en el álbum <strong>${campaignName}</strong> en MyAlbum.` +
      `<br><br>Tu cuenta fue creada automáticamente. Tu contraseña provisional es:` +
      `<br><br><strong style="font-size:20px;letter-spacing:2px;color:#1a1a2e;">${tempPassword}</strong>` +
      `<br><br>Al ingresar, el sistema te pedirá que la cambies por una de tu elección.`
    : `Fuiste invitado a participar en el álbum <strong>${campaignName}</strong> en MyAlbum.` +
      `<br><br>Hacé clic en el botón e ingresá con tu cuenta para unirte.`
  return buildBaseHtml(body, 'Unirme al álbum', joinUrl)
}

export function buildInviteHtml(role: string, inviteLink: string): string {
  const roleLabel = role === 'organizer' ? 'organizador' : 'participante'
  const body =
    `Fuiste invitado a unirte a <strong>MyAlbum</strong> como <strong>${roleLabel}</strong>.` +
    `<br><br>Hacé clic en el botón para activar tu cuenta y crear tu contraseña.` +
    `<br><br><em style="font-size:13px;color:#6b7280;">Este enlace expira en 24 horas.</em>`
  return buildBaseHtml(body, 'Activar cuenta', inviteLink)
}

function buildBaseHtml(body: string, ctaText: string, ctaUrl: string): string {
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
            <a href="${ctaUrl}"
               style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-family:sans-serif;font-size:15px;">
              ${ctaText}
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
