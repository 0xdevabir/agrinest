import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

export function Precision() {
  const { fieldId } = useSessionField()
  const { t, tr, climate, stageLabel } = useI18n()
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

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}

      {data?.advice && (
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>{t('precision.today')}</h2>
            <span className="badge">{stageLabel(data.advice.stage, data.advice.stage_bn)}</span>
          </div>
          <p style={{ fontSize: '1.1rem', color: 'var(--ink)', marginTop: 10 }}>
            {tr(data.advice.summary_bn)}
          </p>
          <p className="muted">
            {t('precision.irrigate')}: {data.advice.irrigate ? t('common.needed') : t('common.skip')}
          </p>
          {data.advice.fertilizer_bn && <p>{tr(data.advice.fertilizer_bn)}</p>}
          <p className="muted">{t('precision.weatherSrc', { source: data.advice.weather_source })}</p>
        </div>
      )}

      <div className="panel" id="climate">
        <h2>Climate Smart</h2>
        {!data?.climate?.alerts?.length && <p className="muted">{t('precision.noRisk')}</p>}
        {data?.climate?.alerts?.map((a) => {
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
        {data?.climate?.variety_hint_bn && (
          <p style={{ marginTop: 12 }}>
            <span className="badge">{t('precision.variety')}</span> {tr(data.climate.variety_hint_bn)}
          </p>
        )}
      </div>
    </>
  )
}
