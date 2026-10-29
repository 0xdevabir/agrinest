import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'

export function YieldPage() {
  const { fieldId } = useSessionField()
  const { t, tr } = useI18n()
  const [y, setY] = useState<NonNullable<Dashboard['yield_estimate']> | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    if (!fieldId) return
    api
      .yieldEst(fieldId)
      .then(setY)
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.loadFail')))
  }, [fieldId, t])

  useEffect(() => {
    load()
  }, [load])

  if (!fieldId) return <Navigate to="/onboarding" replace />

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}

      {y && (
        <div className="panel">
          <h2>{t('yield.estimate')}</h2>
          <p style={{ fontSize: '2rem', margin: '0.4rem 0', fontFamily: 'var(--display)', color: 'var(--sage-deep)' }}>
            {y.mid.toFixed(2)} {y.unit}
          </p>
          <p className="muted">
            {t('yield.rangeBase', {
              low: y.low.toFixed(2),
              high: y.high.toFixed(2),
              base: y.baseline.toFixed(2),
            })}
          </p>
          {y.drivers.length > 0 ? (
            <ul className="steps">
              {y.drivers.map((d) => (
                <li key={d}>{tr(d)}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('yield.noStress')}</p>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="secondary" onClick={load}>
              {t('common.refresh')}
            </button>
            <Link to="/guardian">
              <button type="button">{t('yield.checkDisease')}</button>
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
