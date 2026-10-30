'use client'

import { useState } from 'react'
import { CropPicture } from '@/components/picture'
import { Skeletons, dateLabel, kg } from '@/components/ui'
import { useApp, useData } from '@/lib/app'
import { HEALTH, type Health } from '@/lib/types'

export type OfficerRow = { id: number; name: string; phone: string; organization?: string; district?: string; pending: number; overdue: number; oldest_pending_at: string | null; reviewed_7d: number; reviewed_30d: number; avg_review_hours: number | null; guidance_30d: number; last_review_at: string | null; behind: boolean }
type CropRow = { id: string; en: string; bn: string; emoji: string; reference_price: number | null; plots: number; acres: number; expected_kg: number; harvested_kg: number; sold_kg: number; sold_value: number; avg_price: number | null }
type DistrictRow = { district: string; farmers: number; officers: number; acres: number; at_risk: number; pending: number; overdue: number; sold_value: number }
type Week = { start: string; kg: number; value: number }
export type National = {
  overdue_days: number
  totals: { lands: number; acres: number; growing_acres: number; expected_kg: number; weather_risk: number; deals: number; sold_kg: number; sold_value: number; sold_value_30d: number; government_value: number; farmers: number; officers: number; agents: number; districts: number; pending: number; overdue: number; uncovered_districts: number }
  health: Record<Health, number>
  crops: CropRow[]
  weeks: Week[]
  districts: DistrictRow[]
  officers: OfficerRow[]
}

export const useNational = () => useData<National>('/dashboard/national')

/** Taka in lakh and crore, the way the ministry reads large amounts. */
function useMoney() {
  const { t, num } = useApp()
  return (v: number) => {
    if (v >= 1e7) return `৳${num(Math.round(v / 1e5) / 100)} ${t('কোটি', 'crore')}`
    if (v >= 1e5) return `৳${num(Math.round(v / 1e3) / 100)} ${t('লাখ', 'lakh')}`
    return `৳${num(Math.round(v))}`
  }
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="tile"><span className="sub small">{label}</span><b>{value}</b>{note && <span className="sub small">{note}</span>}</div>
}

export function Trend({ weeks, format }: { weeks: { start: string; value: number }[]; format?: (v: number) => string }) {
  const { t, lang } = useApp()
  const taka = useMoney()
  const money = format ?? taka
  const [active, setActive] = useState(weeks.length - 1)
  const peak = Math.max(...weeks.map((w) => w.value), 1)
  const shown = weeks[active]
  return (
    <>
      <p className="trend-read"><b>{money(shown.value)}</b> <span className="sub small">{t('সপ্তাহ শুরু', 'week of')} {dateLabel(shown.start, lang)}</span></p>
      <div className="trend">
        {weeks.map((w, i) => (
          <button key={w.start} className={i === active ? 'on' : ''} aria-label={`${dateLabel(w.start, lang)}: ${money(w.value)}`} aria-pressed={i === active} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}>
            <span className="trend-track"><i style={{ height: w.value ? `${Math.max(3, (w.value / peak) * 100)}%` : 0 }} /></span>
            <span className="trend-x">{dateLabel(w.start, lang)}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export function HealthBar({ health }: { health: Record<Health, number> }) {
  const { t, num } = useApp()
  const order: Health[] = ['healthy', 'watch', 'treat', 'urgent', 'unknown']
  const total = order.reduce((sum, h) => sum + health[h], 0)
  return (
    <>
      <div className="health-bar" role="img" aria-label={order.map((h) => `${HEALTH[h].en} ${health[h]}`).join(', ')}>
        {order.filter((h) => health[h]).map((h) => <i key={h} style={{ flexGrow: health[h], background: HEALTH[h].color }} title={`${t(HEALTH[h].bn, HEALTH[h].en)}: ${health[h]}`} />)}
      </div>
      <ul className="health-legend">
        {order.map((h) => (
          <li key={h}><i className="dot" style={{ color: HEALTH[h].color }} /><span className="grow">{t(HEALTH[h].bn, HEALTH[h].en)}</span><b>{num(health[h])}</b><span className="sub small">{total ? num(Math.round((health[h] / total) * 100)) : num(0)}%</span></li>
        ))}
      </ul>
    </>
  )
}

export function NationalHome() {
  const { t, num, pick, user } = useApp()
  const { data, error } = useNational()
  const money = useMoney()
  const amount = (v: number) => kg(v, num, t)

  if (error) return <div className="page wide"><div className="notice high" role="alert">{error}</div></div>
  if (!data) return <div className="page wide"><Skeletons n={4} /></div>
  const s = data.totals

  const alerts = [
    s.overdue > 0 && { tone: 'high', text: t(`${num(s.overdue)}টি স্ক্যান ${num(data.overdue_days)} দিনের বেশি রিভিউয়ের অপেক্ষায়`, `${num(s.overdue)} scans waiting over ${num(data.overdue_days)} days for review`) },
    s.uncovered_districts > 0 && { tone: 'warn', text: t(`${num(s.uncovered_districts)}টি জেলায় কোনো কর্মকর্তা নেই`, `${num(s.uncovered_districts)} ${s.uncovered_districts === 1 ? 'district has' : 'districts have'} no officer`) },
    s.weather_risk > 0 && { tone: 'warn', text: t(`${num(s.weather_risk)}টি জমিতে উচ্চ আবহাওয়া ঝুঁকি`, `${num(s.weather_risk)} plots at high weather risk`) },
  ].filter(Boolean) as { tone: string; text: string }[]

  return (
    <div className="page wide">
      <h1 className="large-title">{t('সারা দেশের কৃষি', 'Agriculture across Bangladesh')}</h1>
      <p className="sub">{user?.organization ?? t('জাতীয় পর্যবেক্ষণ', 'National monitoring')}</p>

      {alerts.length > 0 && <div className="alert-row">{alerts.map((a) => <div key={a.text} className={`notice ${a.tone}`} role="status"><span aria-hidden>⚠️</span>{a.text}</div>)}</div>}

      <div className="tiles">
        <Tile label={t('মোট বিক্রি', 'Total sales')} value={money(s.sold_value)} note={`${amount(s.sold_kg)}, ${num(s.deals)} ${t('চুক্তি', 'deals')}`} />
        <Tile label={t('গত ৩০ দিনের বিক্রি', 'Sales, last 30 days')} value={money(s.sold_value_30d)} />
        <Tile label={t('সরকারি ক্রয়', 'Government buying')} value={money(s.government_value)} />
        <Tile label={t('আবাদি জমি', 'Land growing crops')} value={`${num(Math.round(s.growing_acres))} ${t('একর', 'acres')}`} note={`${num(s.lands)} ${t('জমি', 'plots')}, ${num(s.districts)} ${t('জেলা', 'districts')}`} />
        <Tile label={t('সম্ভাব্য উৎপাদন', 'Expected harvest')} value={amount(s.expected_kg)} note={t('আনুমানিক', 'Estimate')} />
        <Tile label={t('কৃষক', 'Farmers')} value={num(s.farmers)} note={`${num(s.officers)} ${t('কর্মকর্তা', 'officers')}, ${num(s.agents)} ${t('এজেন্ট', 'agents')}`} />
      </div>

      <div className="panels">
        <section className="card"><h2>{t('সাপ্তাহিক বিক্রি', 'Weekly sales')}</h2><Trend weeks={data.weeks} /></section>
        <section className="card"><h2>{t('জমির অবস্থা', 'Land health')}</h2><HealthBar health={data.health} /></section>
      </div>

      <h2 className="section-title">{t('ফসল অনুযায়ী', 'By crop')}</h2>
      <div className="table-wrap card">
        <table>
          <thead><tr><th>{t('ফসল', 'Crop')}</th><th>{t('জমি', 'Land')}</th><th>{t('সম্ভাব্য উৎপাদন', 'Expected')}</th><th>{t('কাটা হয়েছে', 'Harvested')}</th><th>{t('বিক্রি', 'Sold')}</th><th>{t('বিক্রির মূল্য', 'Sales value')}</th><th>{t('গড় দর / সাধারণ', 'Avg / usual price')}</th></tr></thead>
          <tbody>
            {data.crops.map((c) => (
              <tr key={c.id}>
                <th scope="row"><CropPicture crop={c.id} frame="chip" alt="" />{pick(c)}</th>
                <td>{c.acres ? `${num(Math.round(c.acres))} ${t('একর', 'acres')}` : '–'}</td>
                <td>{c.expected_kg ? amount(c.expected_kg) : '–'}</td>
                <td>{c.harvested_kg ? amount(c.harvested_kg) : '–'}</td>
                <td>{c.sold_kg ? amount(c.sold_kg) : '–'}</td>
                <td>{c.sold_value ? money(c.sold_value) : '–'}</td>
                <td>{c.avg_price ? `৳${num(c.avg_price)}` : '–'} / ৳{num(c.reference_price ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">{t('জেলা অনুযায়ী', 'By district')}</h2>
      <div className="table-wrap card">
        <table>
          <thead><tr><th>{t('জেলা', 'District')}</th><th>{t('কর্মকর্তা', 'Officers')}</th><th>{t('কৃষক', 'Farmers')}</th><th>{t('জমি', 'Land')}</th><th>{t('ঝুঁকিতে জমি', 'Land at risk')}</th><th>{t('রিভিউ বাকি', 'Reviews waiting')}</th><th>{t('বিক্রি', 'Sales')}</th></tr></thead>
          <tbody>
            {data.districts.map((d) => (
              <tr key={d.district}>
                <th scope="row">{d.district}</th>
                <td>{d.officers ? num(d.officers) : <span className="flag warn">⚠️ {t('পদ খালি', 'Vacant')}</span>}</td>
                <td>{num(d.farmers)}</td>
                <td>{num(Math.round(d.acres))} {t('একর', 'acres')}</td>
                <td>{num(d.at_risk)}</td>
                <td>{num(d.pending)}{d.overdue > 0 && <span className="flag high"> ⚠️ {num(d.overdue)} {t('দেরি', 'late')}</span>}</td>
                <td>{d.sold_value ? money(d.sold_value) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
