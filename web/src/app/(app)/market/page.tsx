'use client'

import { useEffect, useMemo, useState } from 'react'
import { Empty, FlowDone, HealthPill, Segmented, Sheet, StepBar, StepNav, dateLabel, kg } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import type { Crop, Health, Localized } from '@/lib/types'

type Base = Localized & { id: number; crop: string; emoji: string; quantity_kg: number; price_per_kg: number; reference_price: number; district?: string; note?: string; mine: boolean; offers_count: number }
type Listing = Base & { farmer: string; health_status?: Health }
type BuyPost = Base & { buyer: string; buyer_type?: string; needed_by?: string }
type Offer = {
  id: number; source: 'listing' | 'buy_post'; crop_en: string; crop_bn: string; emoji: string
  status: 'pending' | 'accepted' | 'rejected'; quantity_kg: number; price_per_kg: number
  buyer: { name: string; organization?: string }; farmer: { name: string }; my_turn: boolean
  rounds: { mine: boolean; by: string; quantity_kg: number; price_per_kg: number; note?: string; at: string }[]
}
type Board = { listings: Listing[]; buy_posts: BuyPost[]; offers: Offer[] }
type Tab = 'listings' | 'buy_posts' | 'offers'
type Sort = 'new' | 'low' | 'high'
type Target = { kind: 'listing' | 'post'; item: Base; title: string }

const IMAGES = new Set(['rice', 'potato', 'tomato', 'brinjal', 'onion'])

/** Deals get their own column on big screens, so the Deals tab only exists below this width. */
function useWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1180px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

export default function MarketPage() {
  const { t, pick, num, user, toast } = useApp()
  const { data, error, reload } = useData<Board>('/market')
  const isFarmer = user?.role === 'farmer'
  const wide = useWide()
  const mainTab: Tab = isFarmer ? 'buy_posts' : 'listings'
  const [tab, setTab] = useState<Tab>(mainTab)
  const [crop, setCrop] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('new')
  const [target, setTarget] = useState<Target | null>(null)
  const [creating, setCreating] = useState(false)
  const [offer, setOffer] = useState<Offer | null>(null)

  const view: Tab = wide && tab === 'offers' ? mainTab : tab
  const items: Base[] = view === 'listings' ? data?.listings ?? [] : view === 'buy_posts' ? data?.buy_posts ?? [] : []

  const crops = useMemo(() => {
    const seen = new Map<string, Base & { count: number }>()
    items.forEach((b) => seen.set(b.crop, { ...b, count: (seen.get(b.crop)?.count ?? 0) + 1 }))
    return [...seen.values()].sort((a, b) => b.count - a.count)
  }, [items])
  // A crop chosen on one tab may have no lots on the next.
  const activeCrop = crops.some((c) => c.crop === crop) ? crop : null

  const shown = useMemo(() => {
    const list = items.filter((b) => !activeCrop || b.crop === activeCrop)
    if (sort === 'low') return [...list].sort((a, b) => a.price_per_kg - b.price_per_kg)
    if (sort === 'high') return [...list].sort((a, b) => b.price_per_kg - a.price_per_kg)
    return list
  }, [items, activeCrop, sort])

  const deals = useMemo(() => {
    const rank = (o: Offer) => (o.status !== 'pending' ? 2 : o.my_turn ? 0 : 1)
    return [...(data?.offers ?? [])].sort((a, b) => rank(a) - rank(b))
  }, [data])
  const waiting = deals.filter((o) => o.status === 'pending' && o.my_turn).length

  const close = async (path: string) => {
    try { await api(path, { method: 'POST' }); await reload() } catch (e) { toast((e as Error).message) }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'buy_posts', label: t('কিনতে চাই', 'Buy posts') },
    { id: 'listings', label: t('বিক্রি হবে', 'For sale') },
    ...(wide ? [] : [{ id: 'offers' as Tab, label: `${t('দরদাম', 'Deals')}${waiting ? ` (${num(waiting)})` : ''}` }]),
  ]

  const emptyDeals = <Empty icon="🤝">{isFarmer ? t('কেনার পোস্টে প্রস্তাব দিলে দরদাম এখানে দেখা যাবে', 'Offer to sell on a buy post and your deals appear here') : t('ফসলে দর দিলে দরদাম এখানে দেখা যাবে', 'Bid on a crop and your deals appear here')}</Empty>

  return (
    <div className="market">
      <header className="market-hero">
        <div className="grow">
          <h1 className="large-title">{t('বাজার', 'Market')}</h1>
          <p>{isFarmer ? t('ক্রেতা খুঁজুন, দরদাম করে ফসল বিক্রি করুন', 'Find buyers and agree a price for your crop') : t('কৃষকের কাছ থেকে সরাসরি ফসল কিনুন', 'Buy crops directly from farmers')}</p>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>+ {isFarmer ? t('ফসল বিক্রি', 'Sell crop') : t('কেনার পোস্ট', 'Buy post')}</button>
      </header>

      <div className="market-body">
        <aside className="price-board" aria-label={t('ফসল বেছে নিন', 'Choose a crop')}>
          <h2>{t('ফসল ও সাধারণ দর', 'Crops and usual prices')}</h2>
          <div className="group">
            <button className="cell" aria-pressed={!activeCrop} onClick={() => setCrop(null)}>
              <span className="icon-tile" aria-hidden>🧺</span>
              <b className="grow">{t('সব ফসল', 'All crops')}</b>
              <span className="sub">{num(items.length)}</span>
            </button>
            {crops.map((c) => (
              <button className="cell" key={c.crop} aria-pressed={activeCrop === c.crop} onClick={() => setCrop(c.crop)}>
                <span className="icon-tile" aria-hidden>{c.emoji}</span>
                <span className="grow"><b>{pick(c)}</b><div className="sub small">৳{num(c.reference_price)}/{t('কেজি', 'kg')}</div></span>
                <span className="sub">{num(c.count)}</span>
              </button>
            ))}
          </div>
          <p className="sub small">{t('সাধারণ দর মোটামুটি হিসাব। আজকের বাজার যাচাই করুন।', "Usual prices are rough figures. Check today's market.")}</p>
        </aside>

        <main className="market-main">
          <div className="market-tabs"><Segmented value={view} onChange={setTab} options={tabs} /></div>

          {!wide && waiting > 0 && view !== 'offers' && (
            <button className="notice warn deals-alert" onClick={() => setTab('offers')}>
              <span aria-hidden>🤝</span><b className="grow">{num(waiting)} {t('টি দরদামে আপনার উত্তর দরকার', waiting === 1 ? 'deal needs your answer' : 'deals need your answer')}</b><span aria-hidden>›</span>
            </button>
          )}

          {error && <div className="notice high" role="alert">{error}</div>}
          {!data && !error && <div className="lots">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}</div>}

          {data && view !== 'offers' && (
            <>
              <div className="market-tools">
                {crops.length > 1 && (
                  <div className="chips market-chips">
                    <button className={`chip${activeCrop ? '' : ' on'}`} aria-pressed={!activeCrop} onClick={() => setCrop(null)}>{t('সব', 'All')}</button>
                    {crops.map((c) => <button key={c.crop} className={`chip${activeCrop === c.crop ? ' on' : ''}`} aria-pressed={activeCrop === c.crop} onClick={() => setCrop(c.crop)}>{c.emoji} {pick(c)}</button>)}
                  </div>
                )}
                <div className="row between">
                  <span className="sub">{num(shown.length)} {t('টি', shown.length === 1 ? 'lot' : 'lots')}</span>
                  <select className="market-sort" aria-label={t('সাজান', 'Sort')} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="new">{t('নতুন আগে', 'Newest first')}</option>
                    <option value="low">{t('কম দাম আগে', 'Lowest price first')}</option>
                    <option value="high">{t('বেশি দাম আগে', 'Highest price first')}</option>
                  </select>
                </div>
              </div>

              {shown.length > 0 ? (
                <div className={`lots${shown.length === 1 ? ' one' : ''}`}>
                  {shown.map((b) => (
                    <Lot
                      key={b.id}
                      item={b}
                      kind={view === 'listings' ? 'listing' : 'post'}
                      isFarmer={isFarmer}
                      onAct={() => setTarget({ kind: view === 'listings' ? 'listing' : 'post', item: b, title: pick(b) })}
                      onClose={() => close(view === 'listings' ? `/listings/${b.id}/close` : `/buy-posts/${b.id}/close`)}
                    />
                  ))}
                </div>
              ) : view === 'listings'
                ? <Empty icon="🧺">{t('এখন কোনো ফসল বিক্রির জন্য নেই', 'Nothing for sale right now')}</Empty>
                : <Empty icon="📭">{t('এখন কোনো কেনার পোস্ট নেই', 'No buy posts right now')}</Empty>}
            </>
          )}

          {data && view === 'offers' && (deals.length ? <DealList deals={deals} isFarmer={isFarmer} onOpen={setOffer} /> : emptyDeals)}
        </main>

        <aside className="deals-rail" aria-label={t('দরদাম', 'Deals')}>
          <h2>{t('দরদাম', 'Deals')}{waiting > 0 && <span className="xp">{num(waiting)} {t('টি আপনার পালা', 'your turn')}</span>}</h2>
          {!data && !error && <div className="skeleton" style={{ height: 180 }} />}
          {data && (deals.length ? <DealList deals={deals} isFarmer={isFarmer} onOpen={setOffer} /> : emptyDeals)}
        </aside>
      </div>

      {target && (
        <TermsSheet
          title={target.kind === 'listing' ? t('দর দিন', 'Place a bid') : t('বিক্রির প্রস্তাব', 'Offer to sell')}
          subtitle={target.title}
          quantity={target.item.quantity_kg}
          price={target.item.price_per_kg}
          reference={target.item.reference_price}
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

/** Where a price sits against the crop's usual price. Sellers want it high, buyers want it low. */
function PriceGauge({ price, usual, sellerView }: { price: number; usual: number; sellerView: boolean }) {
  const { t, num } = useApp()
  const diff = Math.round(((price - usual) / usual) * 100)
  const near = Math.abs(diff) < 3
  const good = diff > 0 === sellerView
  const color = near ? 'var(--ink-2)' : good ? 'var(--healthy)' : 'var(--treat)'
  const label = near
    ? t('সাধারণ দরের কাছাকাছি', 'Near the usual price')
    : diff > 0
      ? t(`সাধারণ দরের ${num(diff)}% বেশি`, `${diff}% above the usual price`)
      : t(`সাধারণ দরের ${num(-diff)}% কম`, `${-diff}% below the usual price`)
  return (
    <div className="gauge">
      <div className="gauge-track" aria-hidden><i style={{ left: `${Math.min(96, Math.max(4, 50 + diff))}%`, background: color }} /></div>
      <div className="small" style={{ color, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function Lot({ item, kind, isFarmer, onAct, onClose }: { item: Base; kind: 'listing' | 'post'; isFarmer: boolean; onAct: () => void; onClose: () => void }) {
  const { t, pick, num, lang } = useApp()
  const listing = kind === 'listing' ? (item as Listing) : null
  const post = kind === 'post' ? (item as BuyPost) : null
  const canAct = !item.mine && (kind === 'listing' ? !isFarmer : isFarmer)
  const health = listing?.health_status

  return (
    <article className="lot">
      <div className="lot-photo" style={IMAGES.has(item.crop) ? { backgroundImage: `url(/crops/${item.crop}.jpg)` } : undefined}>{!IMAGES.has(item.crop) && <span aria-hidden>{item.emoji}</span>}</div>
      <div className="lot-tag"><b>৳{num(item.price_per_kg)}</b><span>/{t('কেজি', 'kg')}</span></div>
      <div className="lot-head">
        <h3>{pick(item)}</h3>
        <PriceGauge price={item.price_per_kg} usual={item.reference_price} sellerView={isFarmer} />
      </div>
      <div className="lot-foot">
        <dl className="lot-facts">
          <div><dt>{t('পরিমাণ', 'Quantity')}</dt><dd>{kg(item.quantity_kg, num, t)}</dd></div>
          <div><dt>{t('মোট দাম', 'Total value')}</dt><dd>৳{num(Math.round(item.quantity_kg * item.price_per_kg))}</dd></div>
          <div><dt>{post ? t('ক্রেতা', 'Buyer') : t('কৃষক', 'Farmer')}</dt><dd>{post?.buyer ?? listing?.farmer}{post?.buyer_type === 'government' && <span className="sub"> ({t('সরকারি', 'government')})</span>}</dd></div>
          {item.district && <div><dt>{t('জেলা', 'District')}</dt><dd>{item.district}</dd></div>}
          {post?.needed_by && <div><dt>{t('কবে দরকার', 'Needed by')}</dt><dd>{dateLabel(post.needed_by, lang)}</dd></div>}
        </dl>
        {health && health !== 'unknown' && <div><HealthPill status={health} /></div>}
        {item.note && <p className="small">{item.note}</p>}
        <div className="lot-action">
          {item.mine ? (
            <div className="row between">
              <span className="sub small">{num(item.offers_count)} {t('টি প্রস্তাব', item.offers_count === 1 ? 'offer' : 'offers')}</span>
              <button className="btn small danger" onClick={onClose}>{t('বন্ধ করুন', 'Close')}</button>
            </div>
          ) : canAct && (
            <button className="btn block" onClick={onAct}>{kind === 'listing' ? t('দর দিন', 'Place a bid') : t('বিক্রি করতে চাই', 'Offer to sell')}</button>
          )}
        </div>
      </div>
    </article>
  )
}

function DealList({ deals, isFarmer, onOpen }: { deals: Offer[]; isFarmer: boolean; onOpen: (o: Offer) => void }) {
  const { t, num } = useApp()
  return (
    <div className="group">
      {deals.map((o) => (
        <button className="cell" key={o.id} onClick={() => onOpen(o)}>
          <span className="icon-tile" aria-hidden>{o.emoji}</span>
          <span className="grow">
            <b>{t(o.crop_bn, o.crop_en)}</b>
            <div className="small">{kg(o.quantity_kg, num, t)}, ৳{num(o.price_per_kg)}/{t('কেজি', 'kg')}</div>
            <div className="sub small truncate">{isFarmer ? (o.buyer.organization || o.buyer.name) : o.farmer.name}</div>
          </span>
          <StatusPill offer={o} />
        </button>
      ))}
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

function TermsSheet({ title, subtitle, quantity, price, reference, onClose, onSubmit }: { title: string; subtitle?: string; quantity: number; price: number; reference?: number; onClose: () => void; onSubmit: (t: { quantity_kg: number; price_per_kg: number; note: string | null }) => Promise<void> }) {
  const { t, num } = useApp()
  const [q, setQ] = useState(String(quantity))
  const [p, setP] = useState(String(price))
  const [note, setNote] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const steps = [t('দর', 'Price'), t('যাচাই', 'Check')]
  const total = <div className="card row between"><span className="sub">{t('মোট', 'Total')}</span><b style={{ fontSize: 20 }}>৳{num(Math.round(Number(q) * Number(p)) || 0)}</b></div>

  const submit = async () => {
    setBusy(true)
    setError('')
    try { await onSubmit({ quantity_kg: Number(q), price_per_kg: Number(p), note: note.trim() || null }) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose}>
      {checking ? (
        <>
          <StepBar steps={steps} step={2} title={t('মিলিয়ে দেখে পাঠান', 'Check it, then send')} hint={t('অন্য পক্ষ মেনে নিতে, পাল্টা দর দিতে বা বন্ধ করতে পারবে। উত্তর "দরদাম"-এ আসবে।', 'The other side can accept, counter or close. Replies arrive in Deals.')} />
          <div className="card row between"><span className="sub">{t('পরিমাণ ও দাম', 'Quantity and price')}</span><b>{num(Number(q))} {t('কেজি', 'kg')} · ৳{num(Number(p))}</b></div>
          {total}
          <input className="input" maxLength={500} placeholder={t('বার্তা (ঐচ্ছিক)', 'Message (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div className="notice high" role="alert">{error}</div>}
          <StepNav onBack={() => setChecking(false)} onNext={submit} busy={busy} label={`${t('পাঠান', 'Send')} →`} />
        </>
      ) : (
        <>
          <StepBar steps={steps} step={1} title={t('পরিমাণ ও দাম দিন', 'Set the quantity and price')} />
          <div className="grid-2">
            <div><label className="lbl" htmlFor="q">{t('পরিমাণ (কেজি)', 'Quantity (kg)')}</label><input id="q" className="input" type="number" inputMode="decimal" min={1} max={quantity} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="p">{t('দাম (৳/কেজি)', 'Price (৳/kg)')}</label><input id="p" className="input" type="number" inputMode="decimal" min={1} value={p} onChange={(e) => setP(e.target.value)} /></div>
          </div>
          {reference != null && <div className="sub small">{t('আনুমানিক সাধারণ দর', 'Rough usual price')}: ৳{num(reference)}/{t('কেজি', 'kg')}</div>}
          {total}
          <StepNav onNext={() => setChecking(true)} disabled={!(Number(q) >= 1) || !(Number(p) >= 1)} />
        </>
      )}
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
  const [stage, setStage] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = data?.crops.find((c) => c.id === crop)
  const steps = [t('ফসল', 'Crop'), t('দর', 'Price'), t('প্রকাশ', 'Publish')]

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api(isFarmer ? '/listings' : '/buy-posts', { body: { crop, quantity_kg: Number(q), price_per_kg: Number(p), note: note.trim() || null } })
      setStage(4)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet title={isFarmer ? t('ফসল বিক্রি করুন', 'Sell your crop') : t('কেনার পোস্ট দিন', 'Post a buy request')} onClose={stage === 4 ? onDone : onClose}>
      {stage === 1 && (
        <>
          <StepBar steps={steps} step={1} title={isFarmer ? t('কোন ফসল বিক্রি করবেন?', 'Which crop are you selling?') : t('কোন ফসল কিনবেন?', 'Which crop do you want?')} hint={t('ফসলে ট্যাপ করুন', 'Tap the crop')} />
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {(data?.crops ?? []).map((c) => <button key={c.id} className={`chip${crop === c.id ? ' on' : ''}`} aria-pressed={crop === c.id} onClick={() => { setCrop(c.id); if (!p) setP(String(c.reference_price)); setStage(2) }}>{c.emoji} {pick(c)}</button>)}
          </div>
        </>
      )}
      {stage === 2 && (
        <>
          <StepBar steps={steps} step={2} title={`${chosen ? `${chosen.emoji} ${pick(chosen)}: ` : ''}${t('পরিমাণ ও দাম', 'quantity and price')}`} />
          <div className="grid-2">
            <div><label className="lbl" htmlFor="cq">{t('পরিমাণ (কেজি)', 'Quantity (kg)')}</label><input id="cq" className="input" type="number" inputMode="decimal" min={1} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="cp">{t('দাম (৳/কেজি)', 'Price (৳/kg)')}</label><input id="cp" className="input" type="number" inputMode="decimal" min={1} value={p} onChange={(e) => setP(e.target.value)} /></div>
          </div>
          {chosen && <div className="sub small">{t('আনুমানিক সাধারণ দর', 'Rough usual price')}: ৳{num(chosen.reference_price)}/{t('কেজি', 'kg')}. {t('আজকের বাজার যাচাই করুন।', "Check today's market.")}</div>}
          <StepNav onBack={() => setStage(1)} onNext={() => setStage(3)} disabled={!(Number(q) >= 1) || !(Number(p) >= 1)} />
        </>
      )}
      {stage === 3 && (
        <>
          <StepBar steps={steps} step={3} title={t('মিলিয়ে দেখে প্রকাশ করুন', 'Check it, then publish')} hint={t('বিস্তারিত লেখা ঐচ্ছিক।', 'Details are optional.')} />
          <div className="card row between"><span>{chosen?.emoji} {chosen && pick(chosen)} · {num(Number(q))} {t('কেজি', 'kg')} · ৳{num(Number(p))}</span><b>৳{num(Math.round(Number(q) * Number(p)))}</b></div>
          <input className="input" maxLength={500} placeholder={t('বিস্তারিত (ঐচ্ছিক)', 'Details (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div className="notice high" role="alert">{error}</div>}
          <StepNav onBack={() => setStage(2)} onNext={submit} busy={busy} label={`${t('প্রকাশ করুন', 'Publish')} →`} />
        </>
      )}
      {stage === 4 && (
        <FlowDone icon="🎉" title={t('প্রকাশ হয়েছে', 'Published')} body={isFarmer ? t('ক্রেতারা এখন দর দিতে পারবেন। দর এলে "দরদাম"-এ দেখবেন।', 'Buyers can now bid. Bids arrive in Deals.') : t('কৃষকরা এখন প্রস্তাব দিতে পারবেন। প্রস্তাব এলে "দরদাম"-এ দেখবেন।', 'Farmers can now send offers. Offers arrive in Deals.')}>
          <button className="btn block" onClick={onDone}>{t('ঠিক আছে', 'OK')}</button>
        </FlowDone>
      )}
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
