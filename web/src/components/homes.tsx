'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import { HEALTH, type Field, type Health, type Localized } from '@/lib/types'
import { FarmerForm } from './actions'
import { MapStage, addLandSteps, type StageHandle } from './MapStage'
import { TabGlyph } from './tab-icons'
import { Sheet, StepBar, kg } from './ui'

type Level = { level: number; xp: number; floor: number; next: number; pct: number }
type Quest = Localized & { id: string; type: 'add_land' | 'guidance' | 'plant' | 'harvest' | 'scan'; points: number; field_id: number | null; urgent?: boolean }
type FarmData = {
  level: Level
  quests: Quest[]
  fields: Field[]
  alerts: (Localized & { level: string; field_id: number; field_name: string })[]
  totals: { acres: number; growing: number; expected_kg: number }
}

const QUEST_ICON: Record<Quest['type'], string> = { add_land: '📍', guidance: '🧑‍🔬', plant: '🌱', harvest: '🌾', scan: '📸' }

function LandsSheet({ fields, onClose, onOpen, onAdd, onChange }: { fields: Field[]; onClose: () => void; onOpen: (id: number) => void; onAdd: () => void; onChange: () => void | Promise<void> }) {
  const { t, pick, num, toast } = useApp()

  const remove = async (f: Field) => {
    if (!window.confirm(t(`"${f.name}" মুছে ফেলবেন? সব তথ্য মুছে যাবে।`, `Delete "${f.name}" and all its records?`))) return
    try {
      await api(`/fields/${f.id}`, { method: 'DELETE' })
      await onChange()
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <Sheet overMap title={t('আমার জমি', 'My lands')} subtitle={`${num(fields.length)} ${t('টি জমি', 'lands')}`} onClose={onClose}>
      <button className="btn block" onClick={onAdd}>➕ {t('নতুন জমি যোগ করুন', 'Add new land')}</button>
      {fields.length > 0 && (
        <div className="group">
          {fields.map((f) => (
            <div className="cell" key={f.id} style={{ padding: 0 }}>
              <button className="cell grow" style={{ minWidth: 0 }} onClick={() => onOpen(f.id)}>
                <span className="icon-tile" aria-hidden>{f.cycle?.emoji ?? '🟫'}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="truncate" style={{ display: 'block' }}>{f.name}</b>
                  <span className="sub small truncate" style={{ display: 'block' }}>{f.cycle ? pick(f.cycle) : t('ফসল নেই', 'No crop')} · {num(f.area_acres)} {t('একর', 'ac')}</span>
                </span>
              </button>
              <button className="close" style={{ marginRight: 12, flex: 'none' }} aria-label={`${t('মুছুন', 'Delete')}: ${f.name}`} onClick={() => remove(f)}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function FarmHome() {
  const { t, pick, num, user, refreshUser } = useApp()
  const { data, reload } = useData<FarmData>('/dashboard/farm')
  const stage = useRef<StageHandle>(null)
  const [drawing, setDrawing] = useState(false)
  const [managing, setManaging] = useState(false)

  const changed = async () => { await reload(); refreshUser().catch(() => undefined) }
  const start = (q: Quest) => {
    if (q.type === 'add_land') setDrawing(true)
    else if (q.field_id) stage.current?.open(q.field_id, q.type === 'plant' || q.type === 'scan' || q.type === 'harvest' ? q.type : undefined)
  }
  const fields = data?.fields ?? []
  const alert = data?.alerts[0]

  return (
    <MapStage ref={stage} fields={fields} onChange={changed} drawing={drawing} onDrawingChange={setDrawing}>
      <div className="hud-top">
        <div className="glass hud-pill grow">
          <div className="row between">
            <b className="truncate">{user?.name}</b>
            {data && <span className="xp">{t('লেভেল', 'Level')} {num(data.level.level)}</span>}
          </div>
          <div className="progress" style={{ height: 6, margin: '6px 0 4px' }} role="progressbar" aria-valuenow={data?.level.pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="XP"><i style={{ width: `${data?.level.pct ?? 0}%`, background: '#5f7a57' }} /></div>
          {data && <div className="sub small truncate">{num(data.totals.acres)} {t('একর', 'acres')} · {num(data.totals.growing)} {t('ফসল চলছে', 'growing')} · ~{kg(data.totals.expected_kg, num, t)}</div>}
        </div>
      </div>

      <div className="fab">
        <button className="btn lands-btn" onClick={() => setManaging(true)}>
          <span className="tab-ico" aria-hidden><TabGlyph name="field" /></span>{t('আমার জমি', 'My lands')}
          {data && <span className="lands-count">{num(fields.length)}</span>}
        </button>
        <button className="round glass" aria-label={t('সব জমি দেখুন', 'Show all land')} onClick={() => stage.current?.fitAll()}>🎯</button>
      </div>

      {managing && (
        <LandsSheet
          fields={fields}
          onClose={() => setManaging(false)}
          onOpen={(id) => { setManaging(false); stage.current?.open(id) }}
          onAdd={() => { setManaging(false); setDrawing(true) }}
          onChange={changed}
        />
      )}

      <div className="hud-bottom">
        {alert && (
          <button className={`notice glass ${alert.level === 'high' ? 'high' : 'warn'}`} style={{ margin: '0 12px 8px', border: 0, textAlign: 'left', width: 'calc(100% - 24px)', maxWidth: 480 }} onClick={() => stage.current?.open(alert.field_id)}>
            <span aria-hidden>⛈️</span><span><b>{alert.field_name}:</b> {pick(alert)}</span>
          </button>
        )}
        <div className="quests">
          {(data?.quests ?? []).map((q) => (
            <button key={q.id} className="quest glass" onClick={() => start(q)}>
              <span className="icon-tile" aria-hidden>{q.urgent ? '🚨' : QUEST_ICON[q.type]}</span>
              <span className="grow" style={{ fontWeight: 600, fontSize: 15 }}>{pick(q)}</span>
              <span className="xp">+{num(q.points)}</span>
            </button>
          ))}
          {data && !data.quests.length && (
            <div className="quest glass" style={{ cursor: 'default' }}><span className="icon-tile" aria-hidden>✨</span><span style={{ fontWeight: 600 }}>{t('আজকের সব কাজ শেষ!', 'All done for today!')}</span></div>
          )}
        </div>
      </div>
    </MapStage>
  )
}

type AgentData = {
  fields: Field[]
  visit_queue: Field[]
  farmers: { id: number; name: string; village?: string; fields_count: number }[]
  stats: { farmers: number; lands: number; due: number; scans_today: number }
}

export function AgentHome() {
  const { t, num } = useApp()
  const { data, reload } = useData<AgentData>('/dashboard/agent')
  const stage = useRef<StageHandle>(null)
  const [drawing, setDrawing] = useState(false)
  const [farmerId, setFarmerId] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [registering, setRegistering] = useState(false)
  const steps = addLandSteps(t, true)

  // The Farmers page sends the agent here to draw land for the farmer they chose.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('addLandFor'))
    if (!id) return
    window.history.replaceState(null, '', '/')
    setFarmerId(id)
    setDrawing(true)
  }, [])

  const draw = (id: number) => { setFarmerId(id); setPicking(false); setRegistering(false); setDrawing(true) }
  const farmer = data?.farmers.find((f) => f.id === farmerId)

  // A link can name a farmer who is not this agent's; land must never be drawn with no owner.
  useEffect(() => {
    if (data && farmerId && !farmer) { setFarmerId(null); setDrawing(false) }
  }, [data, farmerId, farmer])

  return (
    <MapStage ref={stage} fields={data?.fields ?? []} onChange={reload} showFarmer drawing={drawing} onDrawingChange={setDrawing} drawFarmer={farmer} onDrawBack={() => { setDrawing(false); setPicking(true) }}>
      <div className="hud-top">
        <div className="glass hud-pill grow row between">
          <div><b>{t('আজকের ভিজিট', "Today's visits")}</b><div className="sub small">{num(data?.stats.due ?? 0)} {t('জমি বাকি', data?.stats.due === 1 ? 'land due' : 'lands due')} · {num(data?.stats.scans_today ?? 0)} {t('স্ক্যান হয়েছে', 'scanned')}</div></div>
          <button className="btn small" onClick={() => setPicking(true)}>➕ {t('জমি যোগ করুন', 'Add land')}</button>
        </div>
      </div>

      {picking && (
        <Sheet overMap title={t('নতুন জমি যোগ করুন', 'Add new land')} onClose={() => { setPicking(false); setRegistering(false) }}>
          {registering ? (
            <>
              <StepBar steps={steps} step={1} title={t('নতুন কৃষকের তথ্য দিন', "Enter the new farmer's details")} hint={t('এরপর মানচিত্রে তাঁর জমি আঁকবেন', 'Next you will draw their land on the map')} />
              <FarmerForm label={`${t('যোগ করে জমি আঁকুন', 'Add and draw land')} →`} onBack={() => setRegistering(false)} onDone={async (f) => { await reload(); draw(f.id) }} />
            </>
          ) : (
            <>
              <StepBar steps={steps} step={1} title={t('এই জমি কোন কৃষকের?', 'Whose land is this?')} hint={t('কৃষকের নামে ট্যাপ করুন। এরপর মানচিত্রে জমি আঁকবেন।', "Tap the farmer's name. Next you will draw the land on the map.")} />
              {!data && <div className="skeleton" style={{ height: 120 }} />}
              {data && !data.farmers.length && <div className="sub">{t('এখনো কোনো কৃষক নেই। প্রথমে নিচের বোতাম থেকে কৃষক যোগ করুন।', 'You have no farmers yet. Add one with the button below first.')}</div>}
              {data && data.farmers.length > 0 && (
                <div className="group">
                  {data.farmers.map((f) => (
                    <button key={f.id} className="cell" onClick={() => draw(f.id)}>
                      <span className="icon-tile" aria-hidden>🧑‍🌾</span>
                      <span className="grow"><b>{f.name}</b><div className="sub small truncate">{[f.village, `${num(f.fields_count)} ${t('টি জমি', 'lands')}`].filter(Boolean).join(' · ')}</div></span>
                      <span aria-hidden>›</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn soft block" onClick={() => setRegistering(true)}>➕ {t('তালিকায় নেই? নতুন কৃষক যোগ করুন', 'Not listed? Add a new farmer')}</button>
            </>
          )}
        </Sheet>
      )}
      {!picking && (
        <div className="hud-bottom">
          <div className="quests">
            {(data?.visit_queue ?? []).map((f) => <LandCard key={f.id} field={f} onOpen={() => stage.current?.open(f.id, 'scan')} />)}
            {data && !data.visit_queue.length && <div className="quest glass" style={{ cursor: 'default' }}><span className="icon-tile" aria-hidden>✅</span><b>{t('সব ভিজিট শেষ', 'All visits done')}</b></div>}
          </div>
        </div>
      )}
    </MapStage>
  )
}

type OfficerData = {
  district: string
  fields: Field[]
  stats: { lands: number; farmers: number; pending: number; urgent: number; weather_risk: number; reviewed_today: number; reviewed_week: number }
}

type Filter = 'all' | 'attention' | 'weather' | Health

export function OfficerHome() {
  const { t, num } = useApp()
  const { data, reload } = useData<OfficerData>('/dashboard/officer')
  const stage = useRef<StageHandle>(null)
  const [filter, setFilter] = useState<Filter>('attention')

  const shown = useMemo(() => {
    const all = data?.fields ?? []
    if (filter === 'all') return all
    if (filter === 'weather') return all.filter((f) => f.weather_risk === 'high')
    if (filter === 'attention') return all.filter((f) => f.health_status === 'urgent' || f.health_status === 'treat')
    return all.filter((f) => f.health_status === filter)
  }, [data, filter])

  const chips: { id: Filter; label: string }[] = [
    { id: 'attention', label: `🚨 ${t('জরুরি দেখুন', 'Needs attention')} ${num(data?.stats.urgent ?? 0)}` },
    { id: 'all', label: `${t('সব জমি', 'All land')} ${num(data?.stats.lands ?? 0)}` },
    { id: 'weather', label: `⛈️ ${t('আবহাওয়া ঝুঁকি', 'Weather risk')} ${num(data?.stats.weather_risk ?? 0)}` },
    { id: 'watch', label: t(HEALTH.watch.bn, HEALTH.watch.en) },
    { id: 'healthy', label: t(HEALTH.healthy.bn, HEALTH.healthy.en) },
    { id: 'unknown', label: t(HEALTH.unknown.bn, HEALTH.unknown.en) },
  ]

  return (
    // The whole district stays on the map; the filter only narrows the land list.
    <MapStage ref={stage} fields={data?.fields ?? []} onChange={reload} showFarmer>
      <div className="hud-top">
        <div className="glass hud-pill grow row between">
          <div className="grow">
            <b className="truncate">{data?.district ?? '…'}</b>
            <div className="sub small truncate">{num(data?.stats.farmers ?? 0)} {t('কৃষক', 'farmers')} · {num(data?.stats.pending ?? 0)} {t('রিভিউ বাকি', 'reviews pending')}</div>
          </div>
          <div style={{ textAlign: 'right' }}><b style={{ fontSize: 20 }}>{num(data?.stats.reviewed_today ?? 0)}</b><div className="sub small">{t('আজ রিভিউ', 'reviewed today')}</div></div>
        </div>
      </div>
      <div className="land-rail">
        <div className="chips" style={{ padding: '0 12px' }}>
          {chips.map((c) => <button key={c.id} className={`chip glass${filter === c.id ? ' on' : ''}`} onClick={() => setFilter(c.id)}>{c.label}</button>)}
        </div>
        <div className="quests">
          {shown.map((f) => <LandCard key={f.id} field={f} onOpen={() => stage.current?.open(f.id)} />)}
          {data && !shown.length && <div className="quest glass" style={{ cursor: 'default' }}><span className="icon-tile" aria-hidden>🌿</span>{t('এই তালিকায় কোনো জমি নেই', 'No land in this list')}</div>}
        </div>
      </div>
    </MapStage>
  )
}

function LandCard({ field, onOpen }: { field: Field; onOpen: () => void }) {
  const { t, pick, num } = useApp()
  const h = HEALTH[field.health_status]
  return (
    <button className="quest glass" onClick={onOpen}>
      <span className="icon-tile" style={{ background: `${h.color}26` }} aria-hidden>{field.cycle?.emoji ?? '🟫'}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <b className="truncate" style={{ display: 'block' }}>{field.farmer?.name} · {field.name}</b>
        <span className="sub small truncate" style={{ display: 'block' }}>
          <span style={{ color: h.color, fontWeight: 600 }}>{t(h.bn, h.en)}</span> · {field.cycle ? pick(field.cycle) : t('ফসল নেই', 'No crop')} · {num(field.area_acres)} {t('একর', 'ac')}
        </span>
      </span>
    </button>
  )
}
