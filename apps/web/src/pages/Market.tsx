import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

type Listing = {
  id: string
  crop: string
  quantity_ton: number
  district: string
  price_hint_bdt?: number | null
}

export function Market() {
  const { fieldId } = useSessionField()
  const { t, tr } = useI18n()
  const [market, setMarket] = useState<Dashboard['market'] | null>(null)
  const [yieldMid, setYieldMid] = useState(0)
  const [qty, setQty] = useState('1')
  const [listings, setListings] = useState<Listing[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!fieldId) return
    Promise.all([api.marketHint(fieldId), api.yieldEst(fieldId), api.listings('রংপুর')])
      .then(([m, y, l]) => {
        setMarket(m)
        setYieldMid(y.mid)
        setQty(String(Math.max(0.1, Number((y.mid * 0.5).toFixed(2)))))
        setListings(l as Listing[])
      })
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.loadFail')))
  }, [fieldId, t])

  if (!fieldId) return <Navigate to="/onboarding" replace />

  async function onList(e: FormEvent) {
    e.preventDefault()
    if (!fieldId) return
    setErr('')
    setMsg('')
    try {
      await api.createListing(fieldId, Number(qty))
      setMsg(t('market.published'))
      setListings((await api.listings('রংপুর')) as Listing[])
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('market.listFail'))
    }
  }

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}

      {market && (
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>{t('market.hint')}</h2>
            <span className={`badge ${market.action === 'wait' ? 'warn' : ''}`}>
              {market.action === 'wait' ? t('market.wait') : t('market.sell')}
            </span>
          </div>
          <p style={{ marginTop: 8 }}>{tr(market.reason_bn)}</p>
          <p className="muted">
            {t('common.source')}: {market.source}
          </p>
          <ul className="price-list">
            {market.prices.map((p) => (
              <li key={`${p.market}-${p.date}`}>
                <span>{p.market}</span>
                <strong>
                  ৳{p.price_bdt}/{p.unit}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="panel" onSubmit={onList}>
        <h2>{t('market.listTitle')}</h2>
        <p className="muted">{t('market.maxYield', { mid: yieldMid.toFixed(2) })}</p>
        <div className="field">
          <label htmlFor="qty">{t('market.qty')}</label>
          <input id="qty" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </div>
        <button type="submit">{t('market.publish')}</button>
        {msg && <p style={{ color: 'var(--sage-deep)' }}>{msg}</p>}
      </form>

      <div className="panel">
        <h2>{t('market.buyers')}</h2>
        {!listings.length && <p className="muted">{t('market.noList')}</p>}
        <ul className="price-list">
          {listings.map((l) => (
            <li key={l.id}>
              <span>
                {l.district} · {l.crop}
              </span>
              <strong>{t('market.ton', { n: l.quantity_ton })}</strong>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
