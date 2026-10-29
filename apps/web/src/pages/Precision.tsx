import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

export function Precision() {
  const { fieldId } = useSessionField()
  const { pathname } = useLocation()
  const { t, tr, stageLabel } = useI18n()
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

  const advice = data?.advice
  const view = pathname.endsWith('/irrigation')
    ? 'irrigation'
    : pathname.endsWith('/fertilizer')
      ? 'fertilizer'
      : pathname.endsWith('/stage')
        ? 'stage'
        : 'advice'

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!advice && !err && <p className="muted">{t('common.loading')}</p>}

      {advice && view === 'advice' && (
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>{t('precision.today')}</h2>
            <span className="badge">{stageLabel(advice.stage, advice.stage_bn)}</span>
          </div>
          <p style={{ fontSize: '1.1rem', color: 'var(--ink)', marginTop: 10 }}>{tr(advice.summary_bn)}</p>
          <p className="muted">{t('precision.weatherSrc', { source: advice.weather_source })}</p>
        </div>
      )}

      {advice && view === 'irrigation' && (
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>{t('nav.precision.irrigation')}</h2>
            <span className={`badge ${advice.irrigate ? '' : 'warn'}`}>
              {advice.irrigate ? t('common.needed') : t('common.skip')}
            </span>
          </div>
          <p style={{ fontSize: '1.1rem', color: 'var(--ink)', marginTop: 10 }}>{tr(advice.irrigate_bn)}</p>
        </div>
      )}

      {advice && view === 'fertilizer' && (
        <div className="panel">
          <h2>{t('nav.precision.fertilizer')}</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>
            {advice.fertilizer_bn ? tr(advice.fertilizer_bn) : t('precision.noFert')}
          </p>
          <p className="muted">{stageLabel(advice.stage, advice.stage_bn)}</p>
        </div>
      )}

      {advice && view === 'stage' && (
        <div className="panel">
          <div className="row">
            <h2 style={{ margin: 0 }}>{t('nav.precision.stage')}</h2>
            <span className="badge">{stageLabel(advice.stage, advice.stage_bn)}</span>
          </div>
          <p className="muted">{t('precision.weatherSrc', { source: advice.weather_source })}</p>
        </div>
      )}
    </>
  )
}
