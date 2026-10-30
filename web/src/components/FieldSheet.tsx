'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import type { Field, FieldDetail, Scan } from '@/lib/types'
import { EditLandSheet, GuidanceSheet, HarvestSheet, PlantSheet, ReviewSheet, ScanCard, ScanSheet } from './actions'
import { HealthPill, Sheet, dateLabel, kg } from './ui'

export type FieldIntent = 'plant' | 'scan' | 'harvest'
type Action = FieldIntent | 'guidance' | 'edit-crop' | 'edit-land' | null

const ADVICE_ICON: Record<string, string> = { water: '💧', fertilizer: '🧪', scan: '📸', harvest: '🌾' }

export function FieldSheet({ id, intent, preview, onClose, onChange, onRedraw }: { id: number; intent?: FieldIntent; preview?: Field; onClose: () => void; onChange: () => void | Promise<void>; onRedraw: () => void }) {
  const { t, pick, num, lang, user, toast, refreshUser } = useApp()
  const { data, error, reload } = useData<{ field: FieldDetail }>(`/fields/${id}`)
  const f = data?.field
  const [action, setAction] = useState<Action>(null)
  const [reviewing, setReviewing] = useState<Scan | null>(null)
  const [intentUsed, setIntentUsed] = useState(false)

  const isOfficer = user?.role === 'officer'
  const canManage = user?.role === 'farmer' || user?.role === 'agent'

  // Quests deep-link straight to their action, once the land's data has arrived.
  useEffect(() => {
    if (!f || !intent || intentUsed || !canManage) return
    setIntentUsed(true)
    if (intent === 'plant' ? !f.cycle : !!f.cycle) setAction(intent)
  }, [f, intent, intentUsed, canManage])

  const updated = async () => {
    setAction(null)
    setReviewing(null)
    await Promise.all([reload(), onChange()])
    if (!isOfficer) refreshUser().catch(() => undefined)
  }

  const doneGuidance = async (gid: number) => {
    try {
      await api(`/guidance/${gid}/done`, { method: 'POST' })
      toast(`✅ ${t('দারুণ! কাজ সম্পন্ন', 'Great! Task done')}`)
      await updated()
    } catch (e) { toast((e as Error).message) }
  }

  const removeLand = async () => {
    if (!window.confirm(t('এই জমি মুছে ফেলবেন? সব তথ্য মুছে যাবে।', 'Delete this land and all its records?'))) return
    try {
      await api(`/fields/${id}`, { method: 'DELETE' })
      await onChange()
      onClose()
    } catch (e) { toast((e as Error).message) }
  }

  const head = f ?? preview
  const cycle = head?.cycle
  const pendingGuidance = f?.guidance.filter((g) => !g.done_at) ?? []
  const pendingScans = f?.scans.filter((s) => s.status === 'pending') ?? []

  return (
    <>
      <Sheet
        overMap
        title={<>{cycle?.emoji ?? '🟫'} {head?.name ?? '…'}</>}
        subtitle={head && <>{head.farmer?.name} · {num(head.area_acres)} {t('একর', 'acres')}{head.village ? ` · ${head.village}` : ''}</>}
        onClose={onClose}
      >
        {error && <div className="notice high" role="alert">{error}</div>}
        {!f && !error && <div className="skeleton" style={{ height: 220 }} />}

        {f && (
          <>
            <div className="card stack">
              <div className="row between">
                <HealthPill status={f.health_status} />
                {f.farmer && (isOfficer || user?.role === 'agent') && <a className="btn small soft" href={`tel:${f.farmer.phone}`}>📞 {t('কল', 'Call')}</a>}
              </div>
              {f.cycle ? (
                <>
                  <div className="row between">
                    <div><b style={{ fontSize: 20 }}>{pick(f.cycle)}</b>{f.cycle.variety && <span className="sub"> · {f.cycle.variety}</span>}<div className="sub">{pick(f.cycle.progress.stage)}</div></div>
                    <div style={{ textAlign: 'right' }}><b style={{ fontSize: 20 }}>{num(f.cycle.progress.pct)}%</b><div className="sub small">{t('দিন', 'Day')} {num(f.cycle.progress.day)}/{num(f.cycle.progress.total_days)}</div></div>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={f.cycle.progress.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${f.cycle.progress.pct}%` }} /></div>
                  <div className="sub small">
                    {f.cycle.progress.ready
                      ? `🌾 ${t('ফসল তোলার সময় হয়েছে', 'Ready to harvest')}`
                      : `${t('ফসল তুলতে আরও প্রায়', 'Harvest in about')} ${num(f.cycle.progress.harvest_in_days)} ${t('দিন', 'days')}`}
                  </div>
                </>
              ) : (
                <div className="sub">{t('এই জমিতে এখন কোনো ফসল নেই।', 'Nothing is growing on this land right now.')}</div>
              )}
              {canManage && (
                <div className="row">
                  {!f.cycle && <button className="btn grow" onClick={() => setAction('plant')}>🌱 {t('ফসল লাগান', 'Plant a crop')}</button>}
                  {f.cycle && <button className="btn grow" onClick={() => setAction('scan')}>📸 {t('ছবি পাঠান', 'Send photos')}</button>}
                  {f.cycle && <button className={`btn grow${f.cycle.progress.ready ? '' : ' soft'}`} onClick={() => setAction('harvest')}>🌾 {t('ফসল তুলুন', 'Harvest')}</button>}
                </div>
              )}
              {canManage && (
                <div className="row">
                  {f.cycle && <button className="btn soft small grow" onClick={() => setAction('edit-crop')}>✏️ {t('ফসল সম্পাদনা', 'Edit crop')}</button>}
                  <button className="btn soft small grow" onClick={() => setAction('edit-land')}>⚙️ {t('জমি সম্পাদনা', 'Edit land')}</button>
                </div>
              )}
              {isOfficer && <button className="btn block" onClick={() => setAction('guidance')}>✍️ {t('কৃষককে পরামর্শ দিন', 'Send guidance')}</button>}
            </div>

            {f.alerts.map((a) => (
              <div key={a.code} className={`notice ${a.level === 'high' ? 'high' : a.level === 'medium' ? 'warn' : 'info'}`}><span aria-hidden>⛈️</span><span>{pick(a)}</span></div>
            ))}

            {pendingGuidance.length > 0 && <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>🧑‍🔬 {t('কর্মকর্তার পরামর্শ', 'From your officer')}</h3>}
            {pendingGuidance.map((g) => (
              <div key={g.id} className="card stack" style={{ borderLeft: `4px solid ${g.priority === 'urgent' ? 'var(--urgent)' : 'var(--sage)'}` }}>
                <div><b>{g.title}</b><div style={{ marginTop: 4 }}>{g.body}</div></div>
                <div className="row between">
                  <span className="sub small">{g.officer}{g.due_on ? ` · ${t('শেষ তারিখ', 'by')} ${dateLabel(g.due_on, lang)}` : ''}</span>
                  {canManage && <button className="btn small" onClick={() => doneGuidance(g.id)}>✓ {t('করেছি', 'Done')}</button>}
                </div>
              </div>
            ))}

            {f.advice.length > 0 && (
              <>
                <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>{t('আজ কী করবেন', 'What to do today')}</h3>
                <div className="group">
                  {f.advice.map((a, i) => <div className="cell" key={i}><span className="icon-tile" aria-hidden>{ADVICE_ICON[a.icon] ?? '🌿'}</span><span>{pick(a)}</span></div>)}
                </div>
              </>
            )}

            <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>{t('এই জমির আবহাওয়া', "This land's weather")}</h3>
            <div className="card stack">
              {f.weather ? (
                <>
                  <div className="row between">
                    <div className="row">
                      {f.weather.current.icon && <img src={f.weather.current.icon} alt="" width={44} height={44} />}
                      <div><b style={{ fontSize: 26 }}>{num(Math.round(f.weather.current.temp_c))}°</b><div className="sub small">{f.weather.current.condition}</div></div>
                    </div>
                    <div className="sub small" style={{ textAlign: 'right' }}>💧 {num(f.weather.current.humidity)}%<br />🌧️ {num(f.weather.current.rain_chance)}%<br />💨 {num(Math.round(f.weather.current.wind_kph))} km/h</div>
                  </div>
                  <div className="forecast">
                    {f.weather.daily.slice(0, 7).map((d) => (
                      <div key={d.day}>
                        {d.day}
                        {d.icon && <img src={d.icon} alt={d.condition} />}
                        <b>{num(Math.round(d.high_c))}°</b>
                        <div className="sub">🌧️{num(d.rain_chance)}%</div>
                      </div>
                    ))}
                  </div>
                  {f.weather_synced_at && <div className="sub small">{t('হালনাগাদ', 'Updated')} {new Date(f.weather_synced_at).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit' })} · Atlas</div>}
                </>
              ) : (
                <div className="sub">{t('এখন পূর্বাভাস পাওয়া যাচ্ছে না। একটু পরে আবার দেখুন।', 'Forecast is unavailable right now. Check back soon.')}</div>
              )}
            </div>

            {f.yield && (
              <>
                <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>📈 {t('সম্ভাব্য ফলন', 'Expected yield')}</h3>
                <div className="card stack">
                  <div><b style={{ fontSize: 24 }}>{kg(f.yield.low_kg, num, t)} – {kg(f.yield.high_kg, num, t)}</b>
                    <div className="sub small">{t('এই জমির সর্বোচ্চ সম্ভাবনা', 'This land could reach')} {kg(f.yield.potential_kg, num, t)}</div></div>
                  <div className="sub small">
                    {f.yield.seasons_learned > 0
                      ? t(`এই জমির ${num(f.yield.seasons_learned)}টি মৌসুম থেকে শেখা`, `Learned from ${f.yield.seasons_learned} season(s) on this land`)
                      : t('এখনো গড় হিসাব। ফসল তোলার পর এই জমি থেকে শিখবে।', 'A typical estimate for now. It learns from this land after each harvest.')}
                  </div>
                </div>
              </>
            )}

            {f.scans.length > 0 && <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>🛡️ {t('ক্রপ গার্ড', 'Crop Guard')}</h3>}
            {f.scans.slice(0, 5).map((s) => (
              <ScanCard key={s.id} scan={s} action={isOfficer && s.status === 'pending' ? <button className="btn block" onClick={() => setReviewing(s)}>🔬 {t('রিভিউ করুন', 'Review')}</button> : undefined} />
            ))}
            {isOfficer && !pendingScans.length && f.scans.length === 0 && <div className="sub small">{t('এই জমির কোনো স্ক্যান এখনো আসেনি।', 'No scans from this land yet.')}</div>}

            {!f.cycle && f.next_crops.length > 0 && (
              <>
                <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>🌱 {t('পরে কী লাগাবেন', 'What to plant next')}</h3>
                <div className="group">
                  {f.next_crops.map((c) => (
                    <div className="cell" key={c.crop}>
                      <span className="icon-tile" aria-hidden>{c.emoji}</span>
                      <span className="grow"><b>{pick(c)}</b><div className="sub small">{c.reasons.map((r) => pick(r)).join(' · ')}</div></span>
                      <span className="small" style={{ textAlign: 'right' }}><b>~{kg(c.expected_kg, num, t)}</b><div className="sub">৳{num(c.expected_value_bdt)}</div></span>
                    </div>
                  ))}
                </div>
                <div className="sub small">{t('মোটামুটি হিসাব। কর্মকর্তার সঙ্গে মিলিয়ে নিন।', 'Rough figures. Confirm with your officer.')}</div>
              </>
            )}

            {f.history.length > 0 && (
              <>
                <h3 className="section-title" style={{ margin: '6px 0 -2px' }}>{t('আগের ফসল', 'Past harvests')}</h3>
                <div className="group">
                  {f.history.map((h) => (
                    <div className="cell" key={h.id}>
                      <span aria-hidden>{h.emoji}</span>
                      <span className="grow">{pick(h)}{h.harvested_on && <span className="sub small"> · {dateLabel(h.harvested_on, lang)}</span>}</span>
                      {h.actual_yield_kg != null && <b className="small">{kg(h.actual_yield_kg, num, t)}</b>}
                    </div>
                  ))}
                </div>
              </>
            )}

          </>
        )}
      </Sheet>

      {f && (action === 'plant' || action === 'edit-crop') && <PlantSheet field={f} onClose={() => setAction(null)} onDone={updated} />}
      {f && action === 'edit-land' && <EditLandSheet field={f} onClose={() => setAction(null)} onDone={updated} onRedraw={onRedraw} onRemove={removeLand} />}
      {f && action === 'scan' && <ScanSheet field={f} onClose={() => setAction(null)} onDone={updated} />}
      {f && action === 'harvest' && <HarvestSheet field={f} onClose={() => setAction(null)} onDone={updated} />}
      {f && action === 'guidance' && <GuidanceSheet field={f} onClose={() => setAction(null)} onDone={updated} />}
      {reviewing && <ReviewSheet scan={reviewing} onClose={() => setReviewing(null)} onDone={updated} />}
    </>
  )
}
