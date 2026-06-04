import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, buildNotificationHtml, NOTIFICATION_SUBJECTS, type EmailType } from '@/lib/email'

export const runtime = 'nodejs'

type Payload = Record<string, unknown>

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.PUSH_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, type, payload } = await req.json() as { email: string; type: string; payload: Payload }
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const result = await sendEmail({
      to:      email,
      type:    type as EmailType,
      subject: NOTIFICATION_SUBJECTS[type] ?? '🔔 Nueva notificación — MyAlbum',
      html:    buildNotificationHtml(type, payload ?? {}),
    })

    return NextResponse.json({ ok: result.sent, reason: result.reason })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
