import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

export function Home() {
  const { fieldId } = useSessionField()
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

  const alert0 = data?.climate?.alerts?.[0]
  const alertView = alert0 ? climate(alert0.risk_id, alert0.title_bn, alert0.action_bn) : null

  return (
    <>
      {err && (
        <p className="panel" style={{ color: 'var(--danger)' }}>
          {err}
        </p>
      )}

      {data && (
        <>
          <div className="hero-band">
            <h1>{t('home.hello', { name: data.farmer.name })}</h1>
            <p style={{ margin: '0.35rem 0 0' }}>
              {t('home.fieldLine', {
                district: data.farmer.district,
                area: data.field.area_ha,
                variety: data.field.variety,
              })}
            </p>
          </div>

          <div className="slot-grid">
            <Link className="slot" to="/precision">
              <p className="eyebrow">Precision Farm</p>
              <strong>{t('home.adviceTitle')}</strong>
              <p>{tr(data.advice?.summary_bn, t('common.loading'))}</p>
            </Link>

            <Link className="slot" to="/precision#climate">
              <p className="eyebrow">Climate Smart</p>
              <strong>{alertView?.title ?? t('home.weatherAlert')}</strong>
              <p>{alertView?.action ?? t('home.noAlert')}</p>
              {data.climate?.variety_hint_bn && <p>{tr(data.climate.variety_hint_bn)}</p>}
            </Link>

            <Link className="slot" to="/guardian">
              <p className="eyebrow">Crop Guardian</p>
              <strong>{t('home.dxTitle')}</strong>
              <p>
                {data.latest_diagnosis
                  ? tr(
                      String(data.latest_diagnosis.payload.name_bn ?? ''),
                      String(data.latest_diagnosis.payload.name_en ?? t('home.dxSaved')),
                    ) || t('home.dxSaved')
                  : t('home.dxHint')}
              </p>
            </Link>

            <Link className="slot" to="/yield">
              <p className="eyebrow">YieldMax</p>
              <strong>
                {t('home.yieldTitle', {
                  mid: data.yield_estimate?.mid?.toFixed(2) ?? '—',
                  unit: data.yield_estimate?.unit ?? '',
                })}
              </strong>
              <p>
                {t('home.range', {
                  low: data.yield_estimate?.low?.toFixed(2) ?? '—',
                  high: data.yield_estimate?.high?.toFixed(2) ?? '—',
                })}
              </p>
            </Link>

            <Link className="slot" to="/market">
              <p className="eyebrow">FarmMarket</p>
              <strong>{data.market?.action === 'wait' ? t('home.wait') : t('home.sell')}</strong>
              <p>{tr(data.market?.reason_bn)}</p>
            </Link>
          </div>
        </>
      )}

      {!data && !err && <p className="muted pulse">{t('home.loading')}</p>}
    </>
  )
}
