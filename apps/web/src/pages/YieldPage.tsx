import { Link, Navigate, useLocation } from 'react-router-dom'
import { useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'

export function YieldPage() {
  const { pathname } = useLocation()
  const { lang, t } = useI18n()
  const { fieldId, data, err, reload } = useWorkbench()

  if (!fieldId) return <Navigate to="/onboarding" replace />

  const view = pathname.endsWith('/drivers') ? 'drivers' : pathname.endsWith('/baseline') ? 'baseline' : 'estimate'
  const y = data?.yield
  const fill = y ? Math.min(100, Math.round((y.mid / Math.max(y.baseline, 0.01)) * 100)) : 0

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!y && !err && <p className="muted">{t('common.loading')}</p>}

      {y && view === 'estimate' && (
        <div className="stack">
          <div className="panel">
            <h2>{t('yield.estimate')}</h2>
            <p className="big-num">
              {y.mid.toFixed(2)} <small>{y.unit}</small>
            </p>
            <div className="meter" aria-label={t('wb.ofBase')}>
              <span style={{ width: `${fill}%` }} />
            </div>
            <p className="muted">
              {y.low.toFixed(2)}–{y.high.toFixed(2)} {y.unit}
            </p>
            <button type="button" className="secondary" onClick={reload}>
              {t('common.refresh')}
            </button>
          </div>
          <div className="compare">
            <div className="panel">
              <p className="muted">{t('wb.now')}</p>
              <strong>
                {y.mid.toFixed(2)} {y.unit}
              </strong>
            </div>
            <div className="panel">
              <p className="muted">{t('wb.ifTreat')}</p>
              <strong>
                {y.if_treated_mid.toFixed(2)} {y.unit}
              </strong>
            </div>
          </div>
          {y.open_stress && (
            <Link to="/guardian/treatment" className="panel link-panel">
              {t('wb.logTreat')}
            </Link>
          )}
        </div>
      )}

      {y && view === 'drivers' && (
        <div className="panel">
          <h2>{t('nav.yield.drivers')}</h2>
          {!y.rows.length && <p className="muted">{t('yield.noStress')}</p>}
          {y.rows.map((row, i) => (
            <div key={`${row.id}-${i}`} className="driver">
              <div className="row">
                <span>{lang === 'en' ? row.en : row.bn}</span>
                <strong className={row.pct < 0 ? 'down' : 'up'}>
                  {row.pct > 0 ? '+' : ''}
                  {row.pct}%
                </strong>
              </div>
              <div className="meter">
                <span
                  className={row.pct < 0 ? 'neg' : ''}
                  style={{ width: `${Math.min(100, Math.abs(row.pct) * 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {y && view === 'baseline' && (
        <div className="panel">
          <h2>{t('nav.yield.baseline')}</h2>
          <p className="big-num">
            {y.baseline.toFixed(2)} <small>{y.unit}</small>
          </p>
          <p>
            {y.t_per_ha} t/ha × {y.area_ha} ha × {y.variety_factor}
          </p>
          <p className="muted">{y.variety}</p>
          <p>
            {t('wb.gap')}: {y.gap_ton.toFixed(2)} {y.unit}
          </p>
          <div className="meter">
            <span style={{ width: `${fill}%` }} />
          </div>
        </div>
      )}
    </>
  )
}
