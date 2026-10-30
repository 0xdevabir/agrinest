'use client'

import { useState } from 'react'
import { Link } from '../lib/router'
import { api } from '../api'
import { useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'
import { tx } from '../work/text'

function stepKey(eventId: string, index: number) {
  return `agri_step_${eventId}_${index}`
}

export function GuardianDesk({ view, fieldId }: { view: 'history' | 'treatment'; fieldId: string }) {
  const { lang, t, tr } = useI18n()
  const { data, err, reload } = useWorkbench()
  const [filter, setFilter] = useState<'all' | 'diagnosis' | 'treatment_logged'>('all')
  const [busy, setBusy] = useState(false)
  const [, bump] = useState(0)
  const g = data?.guardian
  const y = data?.yield

  const steps = g?.latest?.steps ?? []
  const eventId = g?.latest?.id ?? 'none'

  function toggle(i: number) {
    const key = stepKey(eventId, i)
    localStorage.setItem(key, localStorage.getItem(key) === '1' ? '0' : '1')
    bump((n) => n + 1)
  }

  async function logAll() {
    setBusy(true)
    try {
      await api.logTreatment(fieldId)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const rows = (g?.history ?? []).filter((row) => filter === 'all' || row.type === filter)

  return (
    <div className="stack">
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!g && !err && <p className="muted">{t('common.loading')}</p>}

      {g && view === 'history' && (
        <>
          <div className="chip-row">
            {(['all', 'diagnosis', 'treatment_logged'] as const).map((id) => (
              <button key={id} type="button" className={filter === id ? '' : 'secondary'} onClick={() => setFilter(id)}>
                {t(id === 'all' ? 'wb.all' : id === 'diagnosis' ? 'nav.guardian.short' : 'wb.treats')}
              </button>
            ))}
          </div>
          {!rows.length && <p className="muted">{t('guardian.emptyHist')}</p>}
          <ul className="dx-timeline">
            {rows.map((row) => (
              <li key={row.id}>
                <span className={`badge ${row.type === 'treatment_logged' ? '' : 'warn'}`}>
                  {row.type === 'treatment_logged' ? t('guardian.done') : `${Math.round((row.confidence ?? 0) * 100)}%`}
                </span>
                <span>
                  {row.type === 'treatment_logged'
                    ? t('guardian.logOk')
                    : tx(row.name, lang) || tr(row.name.bn, row.name.en)}
                  <small className="muted"> {row.created_at?.slice(0, 10)}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {g && view === 'treatment' && (
        <div className="panel">
          <h2>{g.latest ? tx(g.latest.name, lang) || tr(g.latest.name.bn, g.latest.name.en) : t('guardian.emptyHist')}</h2>
          {g.latest?.confidence != null && (
            <div className="meter">
              <span style={{ width: `${Math.round(g.latest.confidence * 100)}%` }} />
            </div>
          )}
          <ul className="check-list">
            {steps.map((step, i) => {
              const on = localStorage.getItem(stepKey(eventId, i)) === '1'
              return (
                <li key={step}>
                  <label>
                    <input type="checkbox" checked={on} onChange={() => toggle(i)} />
                    <span>{tr(step)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          {g.latest?.note && <p className="chem-note">{tr(g.latest.note)}</p>}
          {y?.open_stress && (
            <p className="muted">
              {t('wb.ifTreat')} {y.if_treated_mid.toFixed(2)} {y.unit}
            </p>
          )}
          <div className="row">
            <button type="button" disabled={busy || !g.latest} onClick={logAll}>
              {t('guardian.done')}
            </button>
            <Link to="/guardian">
              <button type="button" className="secondary">
                {t('nav.guardian.scan')}
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
