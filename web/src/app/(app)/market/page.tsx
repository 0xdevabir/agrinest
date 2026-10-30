'use client'

import { useMemo, useState } from 'react'
import { Empty, Segmented, Sheet, Skeletons, dateLabel, kg } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import type { Crop, Localized } from '@/lib/types'

type Base = Localized & { id: number; crop: string; emoji: string; quantity_kg: number; price_per_kg: number; reference_price: number; district?: string; note?: string; mine: boolean; offers_count: number }
type Listing = Base & { farmer: string; health_status?: string }
type BuyPost = Base & { buyer: string; buyer_type?: string; needed_by?: string }
type Offer = {
  id: number; source: 'listing' | 'buy_post'; crop_en: string; crop_bn: string; emoji: string
  status: 'pending' | 'accepted' | 'rejected'; quantity_kg: number; price_per_kg: number
  buyer: { name: string; organization?: string }; farmer: { name: string }; my_turn: boolean
  rounds: { mine: boolean; by: string; quantity_kg: number; price_per_kg: number; note?: string; at: string }[]
}
type Board = { listings: Listing[]; buy_posts: BuyPost[]; offers: Offer[] }
type Tab = 'listings' | 'buy_posts' | 'offers'
type Target = { kind: 'listing' | 'post'; item: Base; title: string }

const IMAGES = new Set(['rice', 'potato', 'tomato', 'brinjal', 'onion'])

export default function MarketPage() {
  const { t, pick, num, user, toast } = useApp()
  const { data, error, reload } = useData<Board>('/market')
  const isFarmer = user?.role === 'farmer'
  const [tab, setTab] = useState<Tab>(isFarmer ? 'buy_posts' : 'listings')
  const [target, setTarget] = useState<Target | null>(null)
  const [creating, setCreating] = useState(false)
  const [offer, setOffer] = useState<Offer | null>(null)

  const waiting = useMemo(() => data?.offers.filter((o) => o.my_turn).length ?? 0, [data])

  const close = async (path: string) => {
    try { await api(path, { method: 'POST' }); await reload() } catch (e) { toast((e as Error).message) }
  }

  const unit = (v: number) => `৳${num(v)}/${t('কেজি', 'kg')}`

  const priceHint = (b: Base) => {
    const diff = Math.round(((b.price_per_kg - b.reference_price) / b.reference_price) * 100)
    if (Math.abs(diff) < 3) return t('বাজার দরের কাছাকাছি', 'Near usual price')
    return diff > 0 ? `${t('সাধারণ দরের', 'Above usual by')} ${num(diff)}%${t(' বেশি', '')}` : `${t('সাধারণ দরের', 'Below usual by')} ${num(-diff)}%${t(' কম', '')}`
  }

  const card = (b: Base, who: string, sub: string | null, kind: 'listing' | 'post') => (
    <div className="card stack" key={`${kind}-${b.id}`}>
      <div className="market-img" style={IMAGES.has(b.crop) ? { backgroundImage: `url(/crops/${b.crop}.jpg)` } : undefined}>{!IMAGES.has(b.crop) && <span aria-hidden>{b.emoji}</span>}</div>
      <div className="row between">
        <b style={{ fontSize: 18 }}>{pick(b)}</b>
        <b style={{ color: 'var(--sage)', fontSize: 18 }}>{unit(b.price_per_kg)}</b>
      </div>
      <div className="row between sub small">
        <span>{kg(b.quantity_kg, num, t)} · {who}{b.district ? ` · ${b.district}` : ''}</span>
        <span style={{ whiteSpace: 'nowrap' }}>{priceHint(b)}</span>
      </div>
      {sub && <div className="sub small">{sub}</div>}
      {b.note && <div className="small">{b.note}</div>}
      {b.mine ? (
        <div className="row between">
          <span className="sub small">{num(b.offers_count)} {t('টি প্রস্তাব', 'offers')}</span>
          <button className="btn small danger" onClick={() => close(kind === 'listing' ? `/listings/${b.id}/close` : `/buy-posts/${b.id}/close`)}>{t('বন্ধ করুন', 'Close')}</button>
        </div>
      ) : (
        ((kind === 'listing' && !isFarmer) || (kind === 'post' && isFarmer)) && (
          <button className="btn block" onClick={() => setTarget({ kind, item: b, title: pick(b) })}>{kind === 'listing' ? t('দর দিন', 'Place a bid') : t('বিক্রি করতে চাই', 'Offer to sell')}</button>
        )
      )}
    </div>
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'buy_posts', label: t('কিনতে চাই', 'Buy posts') },
    { id: 'listings', label: t('বিক্রি হবে', 'For sale') },
    { id: 'offers', label: `${t('দরদাম', 'Deals')}${waiting ? ` (${num(waiting)})` : ''}` },
  ]

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 14 }}>
        <h1 className="large-title">{t('বাজার', 'Market')}</h1>
        <button className="btn small" onClick={() => setCreating(true)}>➕ {isFarmer ? t('ফসল বিক্রি', 'Sell crop') : t('কেনার পোস্ট', 'Buy post')}</button>
      </div>
      <Segmented value={tab} onChange={setTab} options={tabs} />
      <div style={{ height: 14 }} />
      {error && <div className="notice high" role="alert">{error}</div>}
      {!data && !error && <Skeletons />}

      {data && tab === 'listings' && (
        <div className="stack">
          {data.listings.map((l) => card(l, l.farmer, null, 'listing'))}
          {!data.listings.length && <Empty icon="🧺">{t('এখন কোনো ফসল বিক্রির জন্য নেই', 'Nothing for sale right now')}</Empty>}
        </div>
      )}
      {data && tab === 'buy_posts' && (
        <div className="stack">
          {data.buy_posts.map((p) => card(p, p.buyer, p.needed_by ? `${t('দরকার', 'Needed by')} ${dateLabel(p.needed_by, 'bn' === t('bn', 'en') ? 'bn' : 'en')}` : null, 'post'))}
          {!data.buy_posts.length && <Empty icon="📭">{t('এখন কোনো কেনার পোস্ট নেই', 'No buy posts right now')}</Empty>}
        </div>
      )}
      {data && tab === 'offers' && (
        data.offers.length ? (
          <div className="group">
            {data.offers.map((o) => (
              <button className="cell" key={o.id} onClick={() => setOffer(o)}>
                <span className="icon-tile" aria-hidden>{o.emoji}</span>
                <span className="grow">
                  <b>{t(o.crop_bn, o.crop_en)}</b> · {kg(o.quantity_kg, num, t)}
                  <div className="sub small truncate">{isFarmer ? (o.buyer.organization || o.buyer.name) : o.farmer.name} · {unit(o.price_per_kg)}</div>
                </span>
                <StatusPill offer={o} />
              </button>
            ))}
          </div>
        ) : <Empty icon="🤝">{t('এখনো কোনো দরদাম নেই', 'No deals yet')}</Empty>
      )}

      {target && (
        <TermsSheet
          title={target.kind === 'listing' ? t('দর দিন', 'Place a bid') : t('বিক্রির প্রস্তাব', 'Offer to sell')}
          subtitle={target.title}
          quantity={target.item.quantity_kg}
          price={target.item.price_per_kg}
          onClose={() => setTarget(null)}
          onSubmit={async (terms) => {
            await api(target.kind === 'listing' ? `/listings/${target.item.id}/bid` : `/buy-posts/${target.item.id}/offer`, { body: terms })
            setTarget(null)
            setTab('offers')
            toast(`🤝 ${t('প্রস্তাব পাঠানো হয়েছে', 'Offer sent')}`)
            await reload()
          }}
        />
      )}
      {creating && <CreateSheet isFarmer={isFarmer} onClose={() => setCreating(false)} onDone={async () => { setCreating(false); setTab(isFarmer ? 'listings' : 'buy_posts'); await reload() }} />}
      {offer && <OfferSheet offer={offer} onClose={() => setOffer(null)} onChange={async (o) => { setOffer(o); await reload() }} />}
    </div>
  )
}

function StatusPill({ offer }: { offer: Offer }) {
  const { t } = useApp()
  if (offer.status === 'accepted') return <span className="pill" style={{ color: 'var(--healthy)', background: 'rgba(79,163,91,.14)' }}>{t('চুক্তি হয়েছে', 'Deal done')}</span>
  if (offer.status === 'rejected') return <span className="pill" style={{ color: 'var(--ink-2)', background: 'var(--line)' }}>{t('বন্ধ', 'Closed')}</span>
  return offer.my_turn
    ? <span className="pill" style={{ background: 'var(--cream)' }}>{t('আপনার পালা', 'Your turn')}</span>
    : <span className="pill" style={{ color: 'var(--ink-2)', background: 'var(--line)' }}>{t('অপেক্ষায়', 'Waiting')}</span>
}

function TermsSheet({ title, subtitle, quantity, price, onClose, onSubmit }: { title: string; subtitle?: string; quantity: number; price: number; onClose: () => void; onSubmit: (t: { quantity_kg: number; price_per_kg: number; note: string | null }) => Promise<void> }) {
  const { t, num } = useApp()
  const [q, setQ] = useState(String(quantity))
  const [p, setP] = useState(String(price))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try { await onSubmit({ quantity_kg: Number(q), price_per_kg: Number(p), note: note.trim() || null }) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      <div className="grid-2">
        <div><label className="lbl" htmlFor="q">{t('পরিমাণ (কেজি)', 'Quantity (kg)')}</label><input id="q" className="input" type="number" inputMode="decimal" min={1} max={quantity} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="p">{t('দাম (৳/কেজি)', 'Price (৳/kg)')}</label><input id="p" className="input" type="number" inputMode="decimal" min={1} value={p} onChange={(e) => setP(e.target.value)} /></div>
      </div>
      <div className="card row between"><span className="sub">{t('মোট', 'Total')}</span><b style={{ fontSize: 20 }}>৳{num(Math.round(Number(q) * Number(p)) || 0)}</b></div>
      <input className="input" maxLength={500} placeholder={t('বার্তা (ঐচ্ছিক)', 'Message (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice high" role="alert">{error}</div>}
      <button className="btn block" disabled={busy || !(Number(q) >= 1) || !(Number(p) >= 1)} onClick={submit}>{busy ? '…' : t('পাঠান', 'Send')}</button>
    </Sheet>
  )
}

function CreateSheet({ isFarmer, onClose, onDone }: { isFarmer: boolean; onClose: () => void; onDone: () => void | Promise<void> }) {
  const { t, pick, num } = useApp()
  const { data } = useData<{ crops: Crop[] }>('/catalog')
  const [crop, setCrop] = useState('')
  const [q, setQ] = useState('')
  const [p, setP] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = data?.crops.find((c) => c.id === crop)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api(isFarmer ? '/listings' : '/buy-posts', { body: { crop, quantity_kg: Number(q), price_per_kg: Number(p), note: note.trim() || null } })
      await onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet title={isFarmer ? t('ফসল বিক্রি করুন', 'Sell your crop') : t('কেনার পোস্ট দিন', 'Post a buy request')} onClose={onClose}>
      <div className="chips">
        {(data?.crops ?? []).map((c) => <button key={c.id} className={`chip${crop === c.id ? ' on' : ''}`} aria-pressed={crop === c.id} onClick={() => { setCrop(c.id); if (!p) setP(String(c.reference_price)) }}>{c.emoji} {pick(c)}</button>)}
      </div>
      <div className="grid-2">
        <div><label className="lbl" htmlFor="cq">{t('পরিমাণ (কেজি)', 'Quantity (kg)')}</label><input id="cq" className="input" type="number" inputMode="decimal" min={1} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="cp">{t('দাম (৳/কেজি)', 'Price (৳/kg)')}</label><input id="cp" className="input" type="number" inputMode="decimal" min={1} value={p} onChange={(e) => setP(e.target.value)} /></div>
      </div>
      {chosen && <div className="sub small">{t('আনুমানিক সাধারণ দর', 'Rough usual price')}: ৳{num(chosen.reference_price)}/{t('কেজি', 'kg')}. {t('আজকের বাজার যাচাই করুন।', "Check today's market.")}</div>}
      <input className="input" maxLength={500} placeholder={t('বিস্তারিত (ঐচ্ছিক)', 'Details (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div className="notice high" role="alert">{error}</div>}
      <button className="btn block" disabled={busy || !crop || !(Number(q) >= 1) || !(Number(p) >= 1)} onClick={submit}>{busy ? '…' : t('প্রকাশ করুন', 'Publish')}</button>
    </Sheet>
  )
}

function OfferSheet({ offer, onClose, onChange }: { offer: Offer; onClose: () => void; onChange: (o: Offer) => Promise<void> }) {
  const { t, num, toast } = useApp()
  const [countering, setCountering] = useState(false)
  const act = async (verb: 'accept' | 'reject') => {
    try {
      const res = await api<{ offer: Offer }>(`/offers/${offer.id}/${verb}`, { method: 'POST' })
      toast(verb === 'accept' ? `🎉 ${t('চুক্তি হয়েছে!', 'Deal done!')}` : t('প্রস্তাব বন্ধ করা হলো', 'Offer closed'))
      await onChange(res.offer)
    } catch (e) { toast((e as Error).message) }
  }

  if (countering) {
    return (
      <TermsSheet
        title={t('পাল্টা দর', 'Counter offer')}
        quantity={offer.quantity_kg}
        price={offer.price_per_kg}
        onClose={() => setCountering(false)}
        onSubmit={async (terms) => {
          const res = await api<{ offer: Offer }>(`/offers/${offer.id}/counter`, { body: terms })
          setCountering(false)
          await onChange(res.offer)
        }}
      />
    )
  }

  return (
    <Sheet title={<>{offer.emoji} {t(offer.crop_bn, offer.crop_en)}</>} subtitle={`${offer.buyer.organization || offer.buyer.name} ↔ ${offer.farmer.name}`} onClose={onClose}>
      <div className="row between"><StatusPill offer={offer} /><b>{t('মোট', 'Total')} ৳{num(Math.round(offer.quantity_kg * offer.price_per_kg))}</b></div>
      <div className="card stack">
        {offer.rounds.map((r, i) => (
          <div key={i} className={`bubble${r.mine ? ' mine' : ''}`}>
            <b>{num(r.quantity_kg)} {t('কেজি', 'kg')} · ৳{num(r.price_per_kg)}</b>
            {r.note && <div>{r.note}</div>}
            <div className="small" style={{ opacity: .75 }}>{r.by}</div>
          </div>
        ))}
      </div>
      {offer.status === 'pending' && offer.my_turn && (
        <>
          <button className="btn block" onClick={() => act('accept')}>✓ {t('মেনে নিন', 'Accept')}</button>
          <button className="btn soft block" onClick={() => setCountering(true)}>{t('পাল্টা দর দিন', 'Counter')}</button>
        </>
      )}
      {offer.status === 'pending' && !offer.my_turn && <div className="sub" style={{ textAlign: 'center' }}>{t('অন্য পক্ষের উত্তরের অপেক্ষায়', 'Waiting for the other side')}</div>}
      {offer.status === 'pending' && <button className="btn danger block" onClick={() => act('reject')}>{t('প্রস্তাব বন্ধ করুন', 'Close offer')}</button>}
    </Sheet>
  )
}
