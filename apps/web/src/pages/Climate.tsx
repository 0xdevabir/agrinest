import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

export function Climate() {
  const { fieldId } = useSessionField()
  const { pathname } = useLocation()
  const { t, tr, climate } = useI18n()
  const [data, setData] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!fieldId) return
    api
      .dashboard(fieldId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.loadFail')))
  }, [fieldId, t])

  if (!fieldId) return <Navigate to="/onboarding" replace />

  const view = pathname.endsWith('/variety') ? 'variety' : pathname.endsWith('/outlook') ? 'outlook' : 'alerts'
  const alerts = data?.climate?.alerts ?? []

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!data && !err && <p className="muted">{t('common.loading')}</p>}

      {data && view === 'alerts' && (
        <div className="panel">
          <h2>{t('nav.climate.alerts')}</h2>
          {!alerts.length && <p className="muted">{t('precision.noRisk')}</p>}
          {alerts.map((a) => {
            const c = climate(a.risk_id, a.title_bn, a.action_bn)
            return (
              <div key={a.risk_id} style={{ marginTop: 10 }}>
                <div className="row">
                  <strong>{c.title}</strong>
                  <span className={`badge ${a.severity === 'high' ? 'danger' : 'warn'}`}>{a.severity}</span>
                </div>
                <p>{c.action}</p>
              </div>
            )
          })}
        </div>
      )}

      {data && view === 'variety' && (
        <div className="panel">
          <h2>{t('nav.climate.variety')}</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>
            {data.climate?.variety_hint_bn ? tr(data.climate.variety_hint_bn) : t('climate.noVariety')}
          </p>
        </div>
      )}

      {data && view === 'outlook' && (
        <div className="panel">
          <h2>{t('nav.climate.outlook')}</h2>
          <p className="muted">{t('precision.weatherSrc', { source: data.climate?.weather_source ?? data.advice?.weather_source ?? '' })}</p>
          {!alerts.length && <p>{t('precision.noRisk')}</p>}
          {alerts.map((a) => {
            const c = climate(a.risk_id, a.title_bn, a.action_bn)
            return <p key={a.risk_id}>{c.title}</p>
          })}
        </div>
      )}
    </>
  )
}
