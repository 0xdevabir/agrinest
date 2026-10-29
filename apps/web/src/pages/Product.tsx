import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { addToBasket } from '../market/basket'
import { produceById } from '../market/catalog'
import { useWorkbench } from '../hooks/useWorkbench'

export function Product() {
  const { id } = useParams()
  const item = produceById(id || '')
  const { lang, t } = useI18n()
  const { data } = useWorkbench()
  const [kg, setKg] = useState('2')
  const [added, setAdded] = useState(false)

  if (!item) return <Navigate to="/market" replace />

  const amount = Math.max(0.5, Number(kg) || 0)
  const mine = item.id === 'rice'

  function add() {
    addToBasket(item.id, amount)
    setAdded(true)
  }

  return (
    <article className="produce-page">
      <Link to="/market" className="back-link">
        {t('shop.back')}
      </Link>
      <div className="produce-layout">
        <img src={item.image} alt={item.name[lang]} />
        <div className="produce-buy">
          {mine && <p className="stall-pill">{t('shop.yourStall')}</p>}
          <h2>{item.name[lang]}</h2>
          <p className="produce-price">
            ৳{item.price} <small>/{t('shop.kg')}</small>
          </p>
          <p>
            {item.seller[lang]}, {item.district[lang]}
          </p>
          <p className="muted">{item.grade[lang]}</p>
          <p>{item.note[lang]}</p>
          <p className="muted">{t('shop.stock', { n: item.stockKg })}</p>
          {mine && data?.market && (
            <p className="stall-note">
              {t('shop.cap', { n: data.market.remaining_ton.toFixed(2) })}
            </p>
          )}
          <div className="field">
            <label htmlFor="kg">{t('shop.kg')}</label>
            <input id="kg" value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" />
          </div>
          <div className="produce-actions">
            <button type="button" onClick={add}>
              {t('shop.add')}
            </button>
            {mine && (
              <Link to="/market/listings" className="ghost-link">
                {t('shop.listMine')}
              </Link>
            )}
          </div>
          {added && (
            <p className="stall-note">
              {t('shop.added')} · ৳{Math.round(amount * item.price)}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
