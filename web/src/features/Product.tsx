'use client'

import { useState } from 'react'
import { Link, Navigate, useParams } from '../lib/router'
import { api } from '../api'
import { useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'
import { buyersFor, readChoice, writeChoice, type BuyerOffer } from '../market/buyers'
import { produceById } from '../market/catalog'

export function Product() {
  const { id } = useParams()
  const item = produceById(id || '')
  const { lang, t } = useI18n()
  const { fieldId, data, reload } = useWorkbench()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [choice, setChoice] = useState<string | null>(null)

  if (!item) return <Navigate to="/market" replace />
  const produce = item
  const offers = buyersFor(produce)
  const picked = choice ?? readChoice(produce.id)
  const mine = produce.id === 'rice'
  const remainingKg = data?.market ? Math.round(data.market.remaining_ton * 1000) : null

  function tooMuch(offer: BuyerOffer) {
    return mine && remainingKg !== null && offer.qtyKg > remainingKg
  }

  async function give(offer: BuyerOffer) {
    if (picked || busy || tooMuch(offer)) return
    setErr('')
    if (mine) {
      if (!fieldId) return
      setBusy(true)
      try {
        await api.createListing(fieldId, Number((offer.qtyKg / 1000).toFixed(2)))
        reload()
      } catch (error) {
        setErr(error instanceof Error ? error.message : t('market.listFail'))
        setBusy(false)
        return
      }
      setBusy(false)
    }
    writeChoice(produce.id, offer.id)
    setChoice(offer.id)
  }

  return (
    <article className="produce-page">
      <Link to="/market" className="back-link">
        {t('shop.back')}
      </Link>
      <div className="produce-layout">
        <img src={produce.image} alt={produce.name[lang]} />
        <div className="produce-buy">
          {mine && <p className="stall-pill">{t('shop.yourStall')}</p>}
          <h2>{produce.name[lang]}</h2>
          <p className="muted">{t('shop.marketRate')}</p>
          <p className="produce-price">
            ৳{produce.price} <small>/{t('shop.kg')}</small>
          </p>
          <p>
            {produce.seller[lang]}, {produce.district[lang]}
          </p>
          {mine && remainingKg !== null && (
            <p className="stall-note">{t('shop.cap', { n: (remainingKg / 1000).toFixed(2) })}</p>
          )}
        </div>
      </div>

      <h2 className="buyer-heading">{t('shop.buyersTitle')}</h2>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      <ul className="buyer-list">
        {offers.map((offer) => {
          const delta = offer.price - produce.price
          const blocked = tooMuch(offer)
          const chosen = picked === offer.id
          return (
            <li key={offer.id} className={chosen ? 'is-chosen' : ''}>
              <header>
                <strong>{offer.name[lang]}</strong>
                <b>
                  ৳{offer.price}
                  <small>/{t('shop.kg')}</small>
                </b>
              </header>
              <p className={delta >= 0 ? 'up' : 'down'}>
                {delta === 0
                  ? t('shop.vsSame')
                  : delta > 0
                    ? t('shop.vsUp', { n: delta })
                    : t('shop.vsDown', { n: Math.abs(delta) })}
              </p>
              <dl>
                <div>
                  <dt>{t('shop.wantsLabel')}</dt>
                  <dd>{t('shop.wants', { n: offer.qtyKg })}</dd>
                </div>
                <div>
                  <dt>{t('shop.deliver')}</dt>
                  <dd>{offer.deliver[lang]}</dd>
                </div>
                <div>
                  <dt>{t('shop.when')}</dt>
                  <dd>{offer.when[lang]}</dd>
                </div>
                <div>
                  <dt>{t('shop.pay')}</dt>
                  <dd>{offer.pay[lang]}</dd>
                </div>
              </dl>
              {blocked && <p className="down">{t('shop.tooMuch')}</p>}
              <button type="button" disabled={Boolean(picked) || blocked || busy} onClick={() => give(offer)}>
                {chosen ? t('shop.given') : t('shop.give')}
              </button>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
