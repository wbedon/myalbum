'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Album, type AlbumSlot } from '@/lib/supabase'

// ── Local types ────────────────────────────────────────────────────

interface CollMeta {
  id: string
  sticker_id: string
  slot_id: string
  image_url: string
  slot_number: number
  slot_label: string | null
  is_offered: boolean
}

interface OfferMeta {
  id: string
  offerer_id: string
  offerer_username: string
  collection_id: string
  image_url: string
  slot_id: string
  slot_number: number
  slot_label: string | null
}

interface IncomingReq {
  id: string
  offer_id: string
  requester_id: string
  requester_username: string
  req_collection_id: string
  req_image_url: string
  req_slot_number: number
  req_slot_label: string | null
}

interface OutgoingReq {
  id: string
  offer_id: string
  req_collection_id: string
  req_image_url: string
  req_slot_number: number
  req_slot_label: string | null
  offer_image_url: string
  offer_slot_number: number
  offer_slot_label: string | null
  offer_offerer_username: string
}

interface Props {
  album: Album
  currentUserId: string
  slots: AlbumSlot[]
}

// ── Helpers ────────────────────────────────────────────────────────

function StickerCard({ image_url, slot_number, slot_label, size = 'md' }: {
  image_url: string; slot_number: number; slot_label: string | null; size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'w-12 h-16' : 'w-16 h-20'
  return (
    <div className={`${dim} rounded-xl overflow-hidden border-2 border-mundial-purple/10 bg-mundial-cream shrink-0`}>
      {image_url ? (
        <img src={image_url} alt="" className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="font-display text-xs text-mundial-purple/30">#{slot_number}</span>
        </div>
      )}
    </div>
  )
}

function SlotLabel({ number, label }: { number: number; label: string | null }) {
  return (
    <p className="text-[10px] font-condensed font-bold tracking-wider uppercase text-mundial-purple/50">
      #{number}{label ? ` · ${label}` : ''}
    </p>
  )
}

// ── Component ──────────────────────────────────────────────────────

export default function TradeView({ album, currentUserId, slots }: Props) {
  const [loading, setLoading]                   = useState(true)
  const [myCollection, setMyCollection]         = useState<CollMeta[]>([])
  const [marketOffers, setMarketOffers]         = useState<OfferMeta[]>([])
  const [myOffers, setMyOffers]                 = useState<OfferMeta[]>([])
  const [incomingReqs, setIncomingReqs]         = useState<IncomingReq[]>([])
  const [outgoingReqs, setOutgoingReqs]         = useState<OutgoingReq[]>([])

  // UI state
  const [requestingOfferId, setRequestingOfferId] = useState<string | null>(null)
  const [selectedMyItemId, setSelectedMyItemId]   = useState<string | null>(null)
  const [processing, setProcessing]               = useState<string | null>(null)
  const [error, setError]                         = useState<string | null>(null)

  // ── Fetch all data ───────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    const slotMap     = new Map(slots.map((sl) => [sl.id, sl]))

    // 1. My collection
    const { data: myCollRaw } = await supabase
      .from('collection').select('*')
      .eq('album_id', album.id).eq('user_id', currentUserId)

    // 2. All open trade offers for this album
    const { data: offersRaw } = await supabase
      .from('trade_offers').select('*')
      .eq('album_id', album.id).eq('status', 'open')

    // 3. Sticker details for my collection items
    const myStickerIds = Array.from(new Set((myCollRaw ?? []).map((c: { sticker_id: string }) => c.sticker_id)))
    const { data: myStickersRaw } = myStickerIds.length > 0
      ? await supabase.from('stickers').select('id, image_url, slot_id').in('id', myStickerIds)
      : { data: [] }
    const myStickerMap = new Map((myStickersRaw ?? []).map((s: { id: string; image_url: string; slot_id: string }) => [s.id, s]))

    // 4. Collection items referenced by offers (may include mine and others')
    const offerCollIds = Array.from(new Set((offersRaw ?? []).map((o: { collection_id: string }) => o.collection_id)))
    const { data: offerCollRaw } = offerCollIds.length > 0
      ? await supabase.from('collection').select('id, sticker_id').in('id', offerCollIds)
      : { data: [] }
    const offerCollMap = new Map((offerCollRaw ?? []).map((c: { id: string; sticker_id: string }) => [c.id, c]))

    const offerStickerIds = Array.from(new Set((offerCollRaw ?? []).map((c: { sticker_id: string }) => c.sticker_id)))
    const { data: offerStickersRaw } = offerStickerIds.length > 0
      ? await supabase.from('stickers').select('id, image_url, slot_id').in('id', offerStickerIds)
      : { data: [] }
    const offerStickerMap = new Map((offerStickersRaw ?? []).map((s: { id: string; image_url: string; slot_id: string }) => [s.id, s]))

    // 5. Profiles for offerers
    const offererIds = Array.from(new Set((offersRaw ?? []).map((o: { offerer_id: string }) => o.offerer_id)))
    const { data: profilesRaw } = offererIds.length > 0
      ? await supabase.from('profiles').select('user_id, username').in('user_id', offererIds)
      : { data: [] }
    const profileMap = new Map((profilesRaw ?? []).map((p: { user_id: string; username: string | null }) => [p.user_id, p.username]))

    // 6. Build OfferMeta
    const buildOffer = (o: { id: string; offerer_id: string; collection_id: string }): OfferMeta => {
      const coll    = offerCollMap.get(o.collection_id) as { sticker_id: string } | undefined
      const sticker = coll ? offerStickerMap.get(coll.sticker_id) as { image_url: string; slot_id: string } | undefined : undefined
      const slot    = sticker ? slotMap.get(sticker.slot_id) : undefined
      return {
        id:               o.id,
        offerer_id:       o.offerer_id,
        offerer_username: (profileMap.get(o.offerer_id) ?? o.offerer_id.slice(0, 8)) as string,
        collection_id:    o.collection_id,
        image_url:        sticker?.image_url ?? '',
        slot_id:          sticker?.slot_id ?? '',
        slot_number:      slot?.slot_number ?? 0,
        slot_label:       slot?.label ?? null,
      }
    }

    const myOpenOfferCollIds = new Set(
      (offersRaw ?? [])
        .filter((o: { offerer_id: string }) => o.offerer_id === currentUserId)
        .map((o: { collection_id: string }) => o.collection_id)
    )

    // 7. Build my collection with is_offered flag
    const myCollFull: CollMeta[] = (myCollRaw ?? []).map((c: { id: string; sticker_id: string }) => {
      const sticker = myStickerMap.get(c.sticker_id) as { image_url: string; slot_id: string } | undefined
      const slot    = sticker ? slotMap.get(sticker.slot_id) : undefined
      return {
        id:          c.id,
        sticker_id:  c.sticker_id,
        slot_id:     sticker?.slot_id ?? '',
        image_url:   sticker?.image_url ?? '',
        slot_number: slot?.slot_number ?? 0,
        slot_label:  slot?.label ?? null,
        is_offered:  myOpenOfferCollIds.has(c.id),
      }
    })

    const allOffersMeta: OfferMeta[] = (offersRaw ?? []).map(buildOffer)

    // 8. Incoming requests on my offers
    const myOfferIds = allOffersMeta.filter((o: OfferMeta) => o.offerer_id === currentUserId).map((o: OfferMeta) => o.id)
    const [{ data: inReqsRaw }, { data: outReqsRaw }] = await Promise.all([
      myOfferIds.length > 0
        ? supabase.from('trade_requests').select('*').in('offer_id', myOfferIds).eq('status', 'pending')
        : Promise.resolve({ data: [] }),
      supabase.from('trade_requests').select('*')
        .eq('requester_id', currentUserId).eq('status', 'pending'),
    ])

    // 9. Sticker details for request collection items
    const reqCollIds = Array.from(new Set([
      ...(inReqsRaw ?? []).map((r: { collection_id: string }) => r.collection_id),
      ...(outReqsRaw ?? []).map((r: { collection_id: string }) => r.collection_id),
    ]))
    let reqCollMap     = new Map<string, { sticker_id: string }>()
    let reqStickerMap  = new Map<string, { image_url: string; slot_id: string }>()

    if (reqCollIds.length > 0) {
      const { data: reqCollRaw } = await supabase.from('collection').select('id, sticker_id').in('id', reqCollIds)
      reqCollMap = new Map((reqCollRaw ?? []).map((c: { id: string; sticker_id: string }) => [c.id, c]))
      const rsids = Array.from(new Set((reqCollRaw ?? []).map((c: { sticker_id: string }) => c.sticker_id)))
      const { data: rsRaw } = await supabase.from('stickers').select('id, image_url, slot_id').in('id', rsids)
      reqStickerMap = new Map((rsRaw ?? []).map((s: { id: string; image_url: string; slot_id: string }) => [s.id, s]))
    }

    // Profiles for requesters
    const requesterIds = Array.from(new Set((inReqsRaw ?? []).map((r: { requester_id: string }) => r.requester_id)))
    const unknownIds   = requesterIds.filter((id) => !profileMap.has(id))
    if (unknownIds.length > 0) {
      const { data: rp } = await supabase.from('profiles').select('user_id, username').in('user_id', unknownIds)
      ;(rp ?? []).forEach((p: { user_id: string; username: string | null }) => profileMap.set(p.user_id, p.username))
    }

    const getReqSticker = (collId: string) => {
      const coll    = reqCollMap.get(collId)
      const sticker = coll ? reqStickerMap.get(coll.sticker_id) : undefined
      const slot    = sticker ? slotMap.get(sticker.slot_id) : undefined
      return { image_url: sticker?.image_url ?? '', slot_number: slot?.slot_number ?? 0, slot_label: slot?.label ?? null }
    }

    const incoming: IncomingReq[] = (inReqsRaw ?? []).map((r: { id: string; offer_id: string; requester_id: string; collection_id: string }) => ({
      id:                 r.id,
      offer_id:           r.offer_id,
      requester_id:       r.requester_id,
      requester_username: (profileMap.get(r.requester_id) ?? r.requester_id.slice(0, 8)) as string,
      req_collection_id:  r.collection_id,
      ...(() => { const s = getReqSticker(r.collection_id); return { req_image_url: s.image_url, req_slot_number: s.slot_number, req_slot_label: s.slot_label } })(),
    }))

    const outgoing: OutgoingReq[] = (outReqsRaw ?? []).map((r: { id: string; offer_id: string; collection_id: string }) => {
      const relatedOffer = allOffersMeta.find((o: OfferMeta) => o.id === r.offer_id)
      const s = getReqSticker(r.collection_id)
      return {
        id:                    r.id,
        offer_id:              r.offer_id,
        req_collection_id:     r.collection_id,
        req_image_url:         s.image_url,
        req_slot_number:       s.slot_number,
        req_slot_label:        s.slot_label,
        offer_image_url:       relatedOffer?.image_url ?? '',
        offer_slot_number:     relatedOffer?.slot_number ?? 0,
        offer_slot_label:      relatedOffer?.slot_label ?? null,
        offer_offerer_username: relatedOffer?.offerer_username ?? '?',
      }
    })

    setMyCollection(myCollFull)
    setMarketOffers(allOffersMeta.filter((o: OfferMeta) => o.offerer_id !== currentUserId))
    setMyOffers(allOffersMeta.filter((o: OfferMeta) => o.offerer_id === currentUserId))
    setIncomingReqs(incoming)
    setOutgoingReqs(outgoing)
    setLoading(false)
  }, [album.id, currentUserId, slots])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Actions ──────────────────────────────────────────────────────
  const doOffer = async (collectionId: string) => {
    setProcessing(collectionId)
    setError(null)
    const { error: e } = await supabase.rpc('offer_trade', { p_collection_id: collectionId })
    if (e) setError(e.message.includes('already offered') ? 'Ya está en el mercado.' : e.message)
    await fetchAll()
    setProcessing(null)
  }

  const doRequest = async (offerId: string, collectionId: string) => {
    setProcessing(offerId)
    setError(null)
    const { error: e } = await supabase.rpc('request_trade', { p_offer_id: offerId, p_collection_id: collectionId })
    if (e) setError(e.message)
    else { setRequestingOfferId(null); setSelectedMyItemId(null) }
    await fetchAll()
    setProcessing(null)
  }

  const doAccept = async (requestId: string) => {
    setProcessing(requestId)
    setError(null)
    const { error: e } = await supabase.rpc('accept_trade', { p_request_id: requestId })
    if (e) setError(e.message)
    await fetchAll()
    setProcessing(null)
  }

  const doCancelOffer = async (offerId: string) => {
    setProcessing(offerId)
    const { error: e } = await supabase.rpc('cancel_offer', { p_offer_id: offerId })
    if (e) setError(e.message)
    await fetchAll()
    setProcessing(null)
  }

  const doCancelRequest = async (requestId: string) => {
    setProcessing(requestId)
    const { error: e } = await supabase.rpc('cancel_request', { p_request_id: requestId })
    if (e) setError(e.message)
    await fetchAll()
    setProcessing(null)
  }

  // ── Derived ──────────────────────────────────────────────────────
  // Group my collection by slot_id
  const bySlot = new Map<string, CollMeta[]>()
  myCollection.forEach((c) => {
    if (!bySlot.has(c.slot_id)) bySlot.set(c.slot_id, [])
    bySlot.get(c.slot_id)!.push(c)
  })
  const duplicateGroups = Array.from(bySlot.values()).filter((g) => g.length > 1)

  // My available items (not already offered, not already used in a pending request)
  const usedInOutgoing = new Set(outgoingReqs.map((r) => r.req_collection_id))
  const availableForRequest = myCollection.filter((c) => !c.is_offered && !usedInOutgoing.has(c.id))

  // Inline request panel: available items excluding same slot as the offer being requested
  const requestingOffer = marketOffers.find((o) => o.id === requestingOfferId)
  const itemsForRequest = availableForRequest.filter((c) => c.slot_id !== requestingOffer?.slot_id)

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-mundial-cream animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="px-4 py-3 bg-mundial-red/10 border border-mundial-red/30 rounded-xl text-xs text-mundial-red">
          {error}
        </div>
      )}

      {/* ── Mis Duplicados ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
          Mis Duplicados
        </h3>
        {duplicateGroups.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15">
            <p className="font-display text-sm tracking-wider uppercase text-mundial-purple/40">Sin duplicados todavía</p>
            <p className="text-xs text-mundial-purple/30 mt-1">Abrí más sobres para conseguir repetidos.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {duplicateGroups.map((group) => (
              <div key={group[0].slot_id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <SlotLabel number={group[0].slot_number} label={group[0].slot_label} />
                  <span className="text-[10px] font-condensed font-bold text-mundial-purple/40 bg-mundial-purple/8 px-2 py-0.5 rounded-full">
                    ×{group.length}
                  </span>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {group.map((item, idx) => (
                    <div key={item.id} className="flex flex-col items-center gap-1.5">
                      <StickerCard image_url={item.image_url} slot_number={item.slot_number} slot_label={item.slot_label} size="sm" />
                      {idx === 0 ? (
                        <span className="text-[9px] font-condensed font-bold tracking-wider uppercase text-mundial-green">GUARDAR</span>
                      ) : item.is_offered ? (
                        <span className="text-[9px] font-condensed font-bold tracking-wider uppercase text-mundial-yellow-dark">EN MERCADO</span>
                      ) : (
                        <button
                          onClick={() => doOffer(item.id)}
                          disabled={processing === item.id}
                          className="text-[9px] font-condensed font-bold tracking-wider uppercase px-2 py-1 rounded-lg bg-mundial-purple/10 hover:bg-mundial-purple/20 text-mundial-purple disabled:opacity-40 transition-colors"
                        >
                          {processing === item.id ? '…' : 'OFRECER'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Mercado ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
          Mercado · {marketOffers.length} oferta{marketOffers.length !== 1 ? 's' : ''} abiert{marketOffers.length !== 1 ? 'as' : 'a'}
        </h3>
        {marketOffers.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-mundial-purple/15">
            <p className="font-display text-sm tracking-wider uppercase text-mundial-purple/40">Mercado vacío</p>
            <p className="text-xs text-mundial-purple/30 mt-1">Nadie ha puesto stickers a intercambiar todavía.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {marketOffers.map((offer) => {
              const myRequest = outgoingReqs.find((r) => r.offer_id === offer.id)
              const isRequesting = requestingOfferId === offer.id
              return (
                <div key={offer.id} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-4">
                    <StickerCard image_url={offer.image_url} slot_number={offer.slot_number} slot_label={offer.slot_label} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <SlotLabel number={offer.slot_number} label={offer.slot_label} />
                      <p className="font-display text-sm tracking-wide uppercase text-mundial-purple">{offer.offerer_username}</p>
                      <p className="text-xs text-mundial-purple/40">ofrece este sticker</p>
                    </div>
                    <div className="shrink-0">
                      {myRequest ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-condensed font-bold tracking-wider uppercase text-mundial-yellow-dark bg-mundial-yellow/20 px-2 py-1 rounded-lg">
                            Solicitud enviada
                          </span>
                          <button
                            onClick={() => doCancelRequest(myRequest.id)}
                            disabled={processing === myRequest.id}
                            className="text-xs text-mundial-red/60 hover:text-mundial-red disabled:opacity-40 transition-colors"
                          >
                            {processing === myRequest.id ? '…' : 'Cancelar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRequestingOfferId(isRequesting ? null : offer.id); setSelectedMyItemId(null) }}
                          disabled={availableForRequest.length === 0}
                          className="px-3 py-2 bg-mundial-purple hover:bg-mundial-purple/90 disabled:opacity-40 text-white font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                          title={availableForRequest.length === 0 ? 'Necesitás duplicados para intercambiar' : ''}
                        >
                          Solicitar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline request panel */}
                  {isRequesting && (
                    <div className="border-t border-mundial-purple/10 pt-3 space-y-3">
                      <p className="text-xs text-mundial-purple/60 font-condensed font-bold tracking-wider uppercase">
                        ¿Qué ofrecés a cambio?
                      </p>
                      {itemsForRequest.length === 0 ? (
                        <p className="text-xs text-mundial-purple/40 italic">
                          Sin duplicados disponibles (necesitás tener el mismo slot repetido).
                        </p>
                      ) : (
                        <>
                          <div className="flex gap-3 flex-wrap">
                            {itemsForRequest.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedMyItemId(selectedMyItemId === item.id ? null : item.id)}
                                className={[
                                  'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                                  selectedMyItemId === item.id
                                    ? 'border-mundial-purple bg-mundial-purple/10'
                                    : 'border-mundial-purple/15 hover:border-mundial-purple/40',
                                ].join(' ')}
                              >
                                <StickerCard image_url={item.image_url} slot_number={item.slot_number} slot_label={item.slot_label} size="sm" />
                                <SlotLabel number={item.slot_number} label={item.slot_label} />
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => selectedMyItemId && doRequest(offer.id, selectedMyItemId)}
                            disabled={!selectedMyItemId || processing === offer.id}
                            className="px-4 py-2 bg-mundial-yellow hover:bg-mundial-yellow-dark disabled:opacity-40 text-mundial-purple font-display text-xs tracking-wider uppercase rounded-xl transition-colors"
                          >
                            {processing === offer.id ? '…' : 'Confirmar solicitud'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Mis Ofertas ────────────────────────────────────────── */}
      {myOffers.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Mis Ofertas ({myOffers.length})
          </h3>
          <div className="grid gap-4">
            {myOffers.map((offer) => {
              const requests = incomingReqs.filter((r) => r.offer_id === offer.id)
              return (
                <div key={offer.id} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-4">
                    <StickerCard image_url={offer.image_url} slot_number={offer.slot_number} slot_label={offer.slot_label} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <SlotLabel number={offer.slot_number} label={offer.slot_label} />
                      <p className="text-xs text-mundial-purple/50">
                        {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} recibida{requests.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => doCancelOffer(offer.id)}
                      disabled={processing === offer.id}
                      className="text-xs text-mundial-red/60 hover:text-mundial-red disabled:opacity-40 transition-colors shrink-0"
                    >
                      {processing === offer.id ? '…' : 'Cancelar'}
                    </button>
                  </div>

                  {requests.length > 0 && (
                    <div className="border-t border-mundial-purple/10 pt-3 space-y-2">
                      {requests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 bg-mundial-cream/60 rounded-xl px-3 py-2">
                          <StickerCard image_url={req.req_image_url} slot_number={req.req_slot_number} slot_label={req.req_slot_label} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-xs tracking-wide uppercase text-mundial-purple">{req.requester_username}</p>
                            <SlotLabel number={req.req_slot_number} label={req.req_slot_label} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => doAccept(req.id)}
                              disabled={processing === req.id}
                              className="px-3 py-1.5 bg-mundial-green hover:bg-mundial-green/90 disabled:opacity-50 text-white font-display text-[10px] tracking-wider uppercase rounded-lg transition-colors"
                            >
                              {processing === req.id ? '…' : 'Aceptar'}
                            </button>
                            <button
                              onClick={() => doCancelRequest(req.id)}
                              disabled={processing === req.id}
                              className="px-3 py-1.5 bg-mundial-cream hover:bg-mundial-red/10 disabled:opacity-50 text-mundial-red border border-mundial-red/25 font-display text-[10px] tracking-wider uppercase rounded-lg transition-colors"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Mis Solicitudes enviadas ────────────────────────────── */}
      {outgoingReqs.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-mundial-purple/50">
            Mis Solicitudes ({outgoingReqs.length})
          </h3>
          <div className="grid gap-3">
            {outgoingReqs.map((req) => (
              <div key={req.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  {/* What I want */}
                  <div className="flex flex-col items-center gap-1">
                    <StickerCard image_url={req.offer_image_url} slot_number={req.offer_slot_number} slot_label={req.offer_slot_label} size="sm" />
                    <span className="text-[9px] font-condensed text-mundial-purple/40">Quiero</span>
                  </div>
                  {/* Arrow */}
                  <svg className="w-4 h-4 text-mundial-purple/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  {/* What I offer */}
                  <div className="flex flex-col items-center gap-1">
                    <StickerCard image_url={req.req_image_url} slot_number={req.req_slot_number} slot_label={req.req_slot_label} size="sm" />
                    <span className="text-[9px] font-condensed text-mundial-purple/40">Ofrezco</span>
                  </div>
                  <div className="flex-1 min-w-0 ml-1">
                    <p className="text-xs text-mundial-purple/50">a {req.offer_offerer_username}</p>
                    <span className="text-[9px] font-condensed font-bold tracking-wider uppercase text-mundial-yellow-dark">Pendiente</span>
                  </div>
                  <button
                    onClick={() => doCancelRequest(req.id)}
                    disabled={processing === req.id}
                    className="text-xs text-mundial-red/60 hover:text-mundial-red disabled:opacity-40 transition-colors shrink-0"
                  >
                    {processing === req.id ? '…' : 'Cancelar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
