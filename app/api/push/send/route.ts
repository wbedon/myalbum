import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUSH_ICONS: Record<string, string> = {
  sticker_approved:  '✅',
  sticker_rejected:  '❌',
  trade_requested:   '🔄',
  trade_accepted:    '🎉',
  pack_available:    '📦',
}

export async function POST(req: NextRequest) {
  // Verify internal secret
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.PUSH_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { user_id, type, message } = await req.json() as {
      user_id: string; type: string; message: string
    }

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Get all subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({
      title: `MyAlbum ${PUSH_ICONS[type] ?? '🔔'}`,
      body:  message,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   type,
      url:   '/',
    })

    const results = await Promise.allSettled(
      subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async (err: webpush.WebPushError) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        })
      )
    )

    const sent = results.filter((r: PromiseSettledResult<unknown>) => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent, total: subs.length })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
