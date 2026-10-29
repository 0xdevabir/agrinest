import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { markTask, taskDone, useWorkbench } from '../hooks/useWorkbench'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { tx } from '../work/text'

const splitKey: Record<'done' | 'now' | 'wait_rain' | 'later', MessageKey> = {
  done: 'wb.split.done',
  now: 'wb.split.now',
  wait_rain: 'wb.split.wait',
  later: 'wb.split.later',
}


export function Precision() {
  const { pathname } = useLocation()
  const { lang, t } = useI18n()
  const { fieldId, data, err, reload } = useWorkbench()
  const [busy, setBusy] = useState<string | null>(null)
  const [, bump] = useState(0)

  if (!fieldId) return <Navigate to="/onboarding" replace />

  const view = pathname.endsWith('/irrigation')
    ? 'irrigation'
    : pathname.endsWith('/fertilizer')
      ? 'fertilizer'
      : pathname.endsWith('/stage')
        ? 'stage'
        : 'advice'
  const p = data?.precision

  async function done(id: string) {
    if (!fieldId || taskDone(fieldId, id)) return
    setBusy(id)
    try {
      await markTask(fieldId, id)
      bump((n) => n + 1)
      reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {!p && !err && <p className="muted">{t('common.loading')}</p>}

      {p && view === 'advice' && (
        <div className="stack">
          <div className="panel">
            <div className="row">
              <h2 style={{ margin: 0 }}>{tx(p.stage_name, lang)}</h2>
              <span className="badge">
                {p.days_after_sowing} {t('wb.das')}
              </span>
            </div>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round(p.progress * 100)}%` }} />
            </div>
            <p className="muted">
              {t('wb.daysLeft', { n: p.days_left_in_stage })} · {p.weather_source}
            </p>
          </div>
          {p.tasks.map((task) => {
            const finished = taskDone(fieldId, task.id)
            return (
              <div key={task.id} className="panel task-card">
                <div className="row">
                  <h2 style={{ margin: 0 }}>{tx(task.title, lang)}</h2>
                  <span className={`badge ${task.tone === 'skip' ? 'warn' : ''}`}>
                    {task.tone === 'do' ? t('wb.do') : task.tone === 'skip' ? t('wb.skipNow') : t('wb.note')}
                  </span>
                </div>
                <p>{tx(task.detail, lang)}</p>
                <button type="button" className="secondary" disabled={finished || busy === task.id} onClick={() => done(task.id)}>
                  {finished ? t('wb.saved') : t('wb.did')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {p && view === 'irrigation' && (
        <div className="stack">
          <div className="panel">
            <div className="row">
              <h2 style={{ margin: 0 }}>{p.irrigation.decision === 'skip' ? t('wb.skipNow') : t('wb.do')}</h2>
              <span className="badge">{p.irrigation.mm} {t('wb.mm')}</span>
            </div>
            <p>{tx(p.irrigation.why, lang)}</p>
            <p className="muted">{t('wb.rain48', { n: p.irrigation.precip_48h_mm })}</p>
          </div>
          <div className="panel">
            <h2>{t('wb.week')}</h2>
            <div className="day-row">
              {p.irrigation.days.map((d) => (
                <div key={d.date} className="day-cell">
                  <span>{d.date.slice(5)}</span>
                  <strong>{d.precip_mm} mm</strong>
                  <div className="meter mini">
                    <span style={{ width: `${Math.min(100, (d.precip_mm / 20) * 100)}%` }} />
                  </div>
                  <small>{tx(d.chip, lang)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {p && view === 'fertilizer' && (
        <div className="stack">
          <div className="panel">
            <h2>{p.fertilizer.apply_today ? t('wb.applyToday') : t('wb.notToday')}</h2>
            {p.fertilizer.apply_today && (
              <p className="big-num">
                {p.fertilizer.kg_for_field} <small>{t('wb.kg')}</small>
              </p>
            )}
            <p className="muted">
              {p.fertilizer.kg_per_ha} {t('wb.kgPerHa')} · {data?.yield.area_ha} ha
            </p>
            {p.fertilizer.rain_blocked && <p>{t('wb.rainBlock')}</p>}
            <p className="chem-note">{tx(p.fertilizer.note, lang)}</p>
          </div>
          <div className="panel">
            {p.fertilizer.splits.map((s) => (
              <div key={s.stage} className="split-row">
                <div>
                  <strong>{tx(s.label, lang)}</strong>
                  <p className="muted">
                    {s.kg_for_field} {t('wb.kg')} · {tx(s.name, lang)}
                  </p>
                </div>
                <span className={`badge ${s.status === 'now' ? '' : s.status === 'wait_rain' ? 'warn' : ''}`}>
                  {t(splitKey[s.status])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p && view === 'stage' && (
        <div className="panel">
          <h2>{tx(p.stage_name, lang)}</h2>
          <ol className="timeline">
            {p.timeline.map((s) => (
              <li key={s.id} className={`tl tl-${s.state}`}>
                <strong>{tx(s.name, lang)}</strong>
                <span className="muted">
                  {s.day_start}–{s.day_end} {t('wb.das')}
                </span>
                {s.state === 'now' && <p>{tx(s.tip, lang)}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

