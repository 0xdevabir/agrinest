import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'
import { tx } from '../work/text'

export function Climate() {
  const { pathname } = useLocation()
  const { lang, t } = useI18n()
  const { fieldId, data, err } = useWorkbench()
  const [seen, setSeen] = useState<Record<string, boolean>>({})

  if (!fieldId) return <Navigate to="/onboarding" replace />

  const view = pathname.endsWith('/variety') ? 'variety' : pathname.endsWith('/outlook') ? 'outlook' : 'alerts'
  const c = data?.climate

  function ack(id: string) {
    setSeen((s) => ({ ...s, [id]: true }))
    localStorage.setItem(`agri_alert_${fieldId}_${id}`, '1')
  }

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!c && !err && <p className="muted">{t('common.loading')}</p>}

      {c && view === 'alerts' && (
        <div className="stack">
          {!c.alerts.length && <p className="panel muted">{t('precision.noRisk')}</p>}
          {c.alerts.map((a) => {
            const done = seen[a.risk_id] || localStorage.getItem(`agri_alert_${fieldId}_${a.risk_id}`) === '1'
            return (
              <article key={a.risk_id} className={`panel alert-card ${done ? 'is-done' : ''}`}>
                <div className="row">
                  <h2 style={{ margin: 0 }}>{tx(a.title, lang)}</h2>
                  <span className={`badge ${a.severity === 'high' ? 'danger' : 'warn'}`}>{a.severity}</span>
                </div>
                <p className="action-line">{tx(a.action, lang)}</p>
                <button type="button" className="secondary" disabled={done} onClick={() => ack(a.risk_id)}>
                  {done ? t('wb.saved') : t('wb.gotIt')}
                </button>
              </article>
            )
          })}
          <p className="muted">{c.weather_source}</p>
        </div>
      )}

      {c && view === 'variety' && (
        <div className="stack">
          {c.varieties.map((v) => (
            <article key={v.id} className={`panel variety-card ${v.fits ? 'fits' : ''}`}>
              <div className="row">
                <h2 style={{ margin: 0 }}>{tx(v.name, lang)}</h2>
                {v.fits && <span className="badge">{t('wb.fits')}</span>}
              </div>
              <p>{tx(v.why, lang)}</p>
            </article>
          ))}
          <p className="chem-note">{t('wb.varietyNote')}</p>
        </div>
      )}

      {c && view === 'outlook' && (
        <div className="panel">
          <h2>{t('wb.week')}</h2>
          <div className="day-row">
            {c.outlook.map((d) => (
              <div key={d.date} className="day-cell">
                <span>{d.date.slice(5)}</span>
                <strong>{d.temp_max_c}°</strong>
                <small>{d.precip_mm} mm</small>
                <small>{tx(d.chip, lang)}</small>
              </div>
            ))}
          </div>
          <p className="muted">{c.weather_source}</p>
        </div>
      )}
    </>
  )
}
