import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'
import { taka, tx } from '../work/text'

export function Market() {
  const { pathname } = useLocation()
  const { lang, t } = useI18n()
  const { fieldId, data, err, reload } = useWorkbench()
  const [qty, setQty] = useState('')
  const [msg, setMsg] = useState('')
  const [localErr, setLocalErr] = useState('')

  if (!fieldId) return <Navigate to="/onboarding" replace />

  const view = pathname.endsWith('/hint') ? 'hint' : pathname.endsWith('/listings') ? 'listings' : 'prices'
  const m = data?.market
  const maxAvg = m ? Math.max(...m.series.map((s) => s.avg), 1) : 1
  const amount = qty || (m ? String(Math.max(0.1, Number((m.remaining_ton * 0.5).toFixed(2)))) : '0.5')

  async function onList(e: FormEvent) {
    e.preventDefault()
    if (!fieldId) return
    setLocalErr('')
    setMsg('')
    try {
      await api.createListing(fieldId, Number(amount))
      setMsg(t('market.published'))
      reload()
    } catch (error) {
      setLocalErr(error instanceof Error ? error.message : t('market.listFail'))
    }
  }

  return (
    <>
      {(err || localErr) && <p style={{ color: 'var(--danger)' }}>{err || localErr}</p>}
      {!m && !err && <p className="muted">{t('common.loading')}</p>}

      {m && view === 'prices' && (
        <div className="stack">
          {m.best && (
            <div className="panel">
              <p className="muted">{t('wb.best')}</p>
              <h2 style={{ margin: '0.2rem 0' }}>{m.best.market}</h2>
              <p className="big-num">
                ৳{m.best.price_bdt} <small>/{m.best.unit}</small>
              </p>
            </div>
          )}
          <div className="panel">
            <h2>{t('wb.weekPrice')}</h2>
            <div className="day-row">
              {m.series.map((s) => (
                <div key={s.date} className="day-cell">
                  <span>{s.date.slice(5)}</span>
                  <div className="meter mini vert">
                    <span style={{ height: `${(s.avg / maxAvg) * 100}%` }} />
                  </div>
                  <small>{s.avg}</small>
                </div>
              ))}
            </div>
          </div>
          <ul className="price-list panel">
            {m.prices.map((p) => (
              <li key={p.market}>
                <span>
                  {p.market}
                  {m.best?.market === p.market ? ` · ${t('wb.best')}` : ''}
                </span>
                <strong>
                  ৳{p.price_bdt}/{p.unit}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m && view === 'hint' && (
        <div className="stack">
          <div className="panel">
            <div className="row">
              <h2 style={{ margin: 0 }}>{m.action === 'wait' ? t('market.wait') : t('market.sell')}</h2>
              <span className={`badge ${m.action === 'wait' ? 'warn' : ''}`}>{taka(Math.abs(m.delta_bdt))}</span>
            </div>
            <p>{tx(m.reason, lang)}</p>
          </div>
          <div className="compare">
            <div className="panel">
              <p className="muted">{t('wb.sellToday')}</p>
              <strong>{taka(m.now_bdt)}</strong>
              <small className="muted">
                {m.today_avg} × {t('wb.quintal')}
              </small>
            </div>
            <div className="panel">
              <p className="muted">{t('wb.waitValue')}</p>
              <strong>{taka(m.wait_bdt)}</strong>
              <small className="muted">{t('wb.weekAvg', { n: m.mean7 })}</small>
            </div>
          </div>
          <p className="muted">{m.source}</p>
        </div>
      )}

      {m && view === 'listings' && (
        <form className="panel" onSubmit={onList}>
          <h2>{t('market.listTitle')}</h2>
          <p className="muted">{t('wb.leftToList', { n: m.remaining_ton.toFixed(2), listed: m.listed_ton.toFixed(2) })}</p>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (m.listed_ton / Math.max(m.cap_ton, 0.01)) * 100)}%` }} />
          </div>
          <div className="field">
            <label htmlFor="qty">{t('market.qty')}</label>
            <input id="qty" value={amount} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          </div>
          <button type="submit">{t('market.publish')}</button>
          {msg && <p style={{ color: 'var(--sage-deep)' }}>{msg}</p>}
          <ul className="price-list">
            {m.listings.map((l) => (
              <li key={l.id}>
                <span>{l.district}</span>
                <strong>
                  {l.quantity_ton} {t('unit.ton')}
                </strong>
              </li>
            ))}
          </ul>
          {!m.listings.length && <p className="muted">{t('market.noList')}</p>}
        </form>
      )}
    </>
  )
}

