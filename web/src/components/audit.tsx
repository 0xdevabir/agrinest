'use client'

import { useState } from 'react'
import { HealthBar, Tile, Trend } from '@/components/national'
import { HealthPill, Sheet, Skeletons, dateLabel } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import type { Guidance, Health, Scan } from '@/lib/types'

export type Changes = { before?: Record<string, unknown>; after?: Record<string, unknown> }
export type AuditEntry = {
  id: number
  at: string
  actor: string | null
  actor_id: number | null
  role: string | null
  action: string
  subject_type: string | null
  subject_id: number | null
  subject: string | null
  district: string | null
  changes: Changes | null
  ip?: string | null
  user_agent?: string | null
  hash?: string
}
export type ReviewedScan = Scan & { ai_verdict: Health; response_hours: number | null; reviewed_at?: string | null; guidance: Guidance | null }
export type Performance = {
  officer: { id: number; name: string; phone: string; organization?: string; district?: string; upazila?: string; since?: string }
  overdue_days: number
  stats: { pending: number; overdue: number; reviewed_today: number; reviewed_30d: number; reviewed_total: number; avg_hours_30d: number | null; on_time_pct: number | null; ai_agreement_pct: number | null; guidance_sent: number; guidance_done_pct: number | null }
  verdicts: Record<Health, number>
  weeks: { start: string; value: number }[]
  activity: AuditEntry[]
}

const ENTITY: Record<string, [string, string]> = {
  user: ['অ্যাকাউন্ট', 'Account'],
  field: ['জমি', 'Land'],
  crop_cycle: ['ফসল', 'Crop'],
  scan: ['স্ক্যান', 'Scan'],
  guidance: ['পরামর্শ', 'Guidance'],
  listing: ['বিক্রির তালিকা', 'Listing'],
  buy_post: ['ক্রয় পোস্ট', 'Buy post'],
  offer: ['দরপ্রস্তাব', 'Offer'],
  offer_round: ['দর আলোচনা', 'Negotiation'],
}
const VERB: Record<string, [string, string]> = {
  created: ['তৈরি', 'created'],
  updated: ['পরিবর্তন', 'changed'],
  deleted: ['মুছে ফেলা', 'removed'],
  reviewed: ['রিভিউ সম্পন্ন', 'reviewed'],
  done: ['সম্পন্ন', 'marked done'],
  harvested: ['কাটা হয়েছে', 'harvested'],
  accepted: ['গৃহীত', 'accepted'],
  rejected: ['প্রত্যাখ্যাত', 'rejected'],
  countered: ['পাল্টা দর', 'countered'],
  closed: ['বন্ধ', 'closed'],
  sold: ['বিক্রি', 'sold'],
  history_removed: ['ইতিহাসও মুছে ফেলা', 'history removed'],
}
const WHOLE: Record<string, [string, string]> = {
  'auth.login': ['সাইন ইন', 'Signed in'],
  'auth.logout': ['সাইন আউট', 'Signed out'],
  'auth.login_failed': ['ব্যর্থ সাইন ইন', 'Failed sign-in'],
  'audit.exported': ['অডিট রেকর্ড ডাউনলোড', 'Audit record downloaded'],
}

export function actionLabel(action: string, t: (bn: string, en: string) => string) {
  if (WHOLE[action]) return t(...WHOLE[action])
  const [entity, verb] = action.split('.')
  const name = ENTITY[entity] ? t(...ENTITY[entity]) : entity
  return `${name}: ${VERB[verb] ? t(...VERB[verb]) : verb.replace(/_/g, ' ')}`
}

export function useStamp() {
  const { lang } = useApp()
  return (iso: string) => new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Hours as the shortest honest wording: minutes, hours, then days. */
export function useDuration() {
  const { t, num } = useApp()
  return (hours: number) => {
    if (hours < 1) return `${num(Math.max(1, Math.round(hours * 60)))} ${t('মিনিট', 'min')}`
    if (hours < 48) return `${num(Math.round(hours * 10) / 10)} ${t('ঘণ্টা', 'hrs')}`
    return `${num(Math.round(hours / 24))} ${t('দিন', 'days')}`
  }
}

function show(value: unknown) {
  if (value === null || value === undefined || value === '') return '–'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function ChangesTable({ changes }: { changes: Changes | null }) {
  const { t } = useApp()
  const keys = [...new Set([...Object.keys(changes?.before ?? {}), ...Object.keys(changes?.after ?? {})])]
  if (!keys.length) return null
  return (
    <table className="changes">
      <thead><tr><th>{t('তথ্য', 'Detail')}</th><th>{t('আগে', 'Before')}</th><th>{t('পরে', 'After')}</th></tr></thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <th scope="row">{k.replace(/_/g, ' ')}</th>
            <td><del>{show(changes?.before?.[k])}</del></td>
            <td><ins>{show(changes?.after?.[k])}</ins></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ActivityList({ entries }: { entries: AuditEntry[] }) {
  const { t } = useApp()
  const stamp = useStamp()
  if (!entries.length) return <p className="sub small">{t('এখনো কোনো কার্যক্রম নেই', 'Nothing recorded yet')}</p>
  return (
    <ul className="log">
      {entries.map((e) => (
        <li key={e.id}>
          <time dateTime={e.at}>{stamp(e.at)}</time>
          <span className="grow" style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{actionLabel(e.action, t)}</b>{e.subject && e.action !== 'auth.login' && e.action !== 'auth.logout' ? <div className="sub small truncate">{e.subject}</div> : null}</span>
        </li>
      ))}
    </ul>
  )
}

/** One scan's record from submission to the farmer acting on the advice. */
export function TrailSheet({ scanId, onClose }: { scanId: number; onClose: () => void }) {
  const { t, lang } = useApp()
  const stamp = useStamp()
  const duration = useDuration()
  const { data, error } = useData<{ scan: ReviewedScan; entries: AuditEntry[] }>(`/scans/${scanId}/trail`)
  const scan = data?.scan
  return (
    <Sheet title={t('স্ক্যানের রেকর্ড', 'Scan record')} subtitle={scan?.field ? `${scan.field.farmer?.name}, ${scan.field.name}` : undefined} onClose={onClose}>
      {error && <div className="notice high" role="alert">{error}</div>}
      {!data && !error && <Skeletons n={2} />}
      {scan && data && (
        <>
          {scan.photos.length > 0 && <div className="photos">{scan.photos.map((p) => <img key={p} src={p} alt="" loading="lazy" />)}</div>}
          <div className="card">
            <dl className="facts">
              <dt>{t('AI-এর ধারণা', 'AI finding')}</dt>
              <dd>{lang === 'bn' ? scan.ai.name_bn : scan.ai.name_en}</dd>
              <dt>{t('AI-এর পরামর্শিত মান', 'AI suggested')}</dt>
              <dd><HealthPill status={scan.ai_verdict} /></dd>
              <dt>{t('কর্মকর্তার সিদ্ধান্ত', 'Officer verdict')}</dt>
              <dd>{scan.verdict ? <HealthPill status={scan.verdict} /> : t('অপেক্ষায়', 'Waiting')}</dd>
              {scan.reviewer && <><dt>{t('রিভিউ করেছেন', 'Reviewed by')}</dt><dd>{scan.reviewer}</dd></>}
              {scan.response_hours !== null && <><dt>{t('সাড়ার সময়', 'Response time')}</dt><dd>{duration(scan.response_hours)}</dd></>}
              {scan.guidance && <><dt>{t('পরামর্শ', 'Guidance')}</dt><dd>{scan.guidance.title}<div className="sub small">{scan.guidance.done_at ? `${t('কৃষক সম্পন্ন করেছেন', 'Farmer finished')} ${dateLabel(scan.guidance.done_at, lang)}` : t('কৃষক এখনো সম্পন্ন করেননি', 'Farmer has not finished yet')}</div></dd></>}
            </dl>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('কে কখন কী করেছেন', 'Who did what, and when')}</h3>
          {data.entries.length === 0 && <p className="sub small">{t('অডিট চালুর আগের স্ক্যান, তাই এর ধাপগুলো রেকর্ডে নেই।', 'This scan predates the audit trail, so its steps were not recorded.')}</p>}
          <ol className="timeline">
            {data.entries.map((e) => (
              <li key={e.id}>
                <b>{actionLabel(e.action, t)}</b>
                <div className="sub small">{e.actor ?? t('সিস্টেম', 'System')}, {stamp(e.at)}</div>
                <ChangesTable changes={e.changes} />
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  )
}

/** Runs the tamper check on demand; it walks the whole log, so it isn't run on every page view. */
export function ChainCheck() {
  const { t, num } = useApp()
  const [result, setResult] = useState<{ ok: boolean; entries: number; broken_id: number | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setBusy(true)
    setError(null)
    try { setResult(await api('/audit/verify')) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <button className="btn soft small" disabled={busy} onClick={run}>{busy ? '…' : t('রেকর্ড অক্ষত কি না যাচাই করুন', 'Check the record is intact')}</button>
      {error && <div className="notice high" role="alert">{error}</div>}
      {result && (result.ok
        ? <span className="flag ok" role="status">✓ {t(`${num(result.entries)}টি এন্ট্রির কোনোটিতে পরিবর্তনের চিহ্ন নেই`, `No sign of tampering in ${num(result.entries)} entries`)}</span>
        : <span className="flag high" role="alert">⚠️ {t(`এন্ট্রি #${num(result.broken_id ?? 0)}-এ পরিবর্তনের চিহ্ন পাওয়া গেছে`, `Entry #${num(result.broken_id ?? 0)} shows signs of tampering`)}</span>)}
    </div>
  )
}

/** An officer's record; the same view for the officer and for the admins above them. */
export function PerformancePanel({ data }: { data: Performance }) {
  const { t, num } = useApp()
  const duration = useDuration()
  const s = data.stats
  const pct = (v: number | null) => (v === null ? '–' : `${num(v)}%`)
  return (
    <>
      <div className="tiles">
        <Tile label={t('রিভিউ বাকি', 'Waiting')} value={num(s.pending)} note={s.overdue ? t(`${num(s.overdue)}টি ${num(data.overdue_days)} দিনের বেশি পুরনো`, `${num(s.overdue)} over ${num(data.overdue_days)} days`) : t('কোনোটিতে দেরি নেই', 'None late')} />
        <Tile label={t('৩০ দিনে রিভিউ', 'Reviewed, 30 days')} value={num(s.reviewed_30d)} note={`${num(s.reviewed_total)} ${t('মোট', 'in total')}`} />
        <Tile label={t('গড় সাড়ার সময়', 'Average response')} value={s.avg_hours_30d === null ? '–' : duration(s.avg_hours_30d)} note={t('গত ৩০ দিন', 'Last 30 days')} />
        <Tile label={t('সময়মতো রিভিউ', 'Reviewed on time')} value={pct(s.on_time_pct)} note={t(`${num(data.overdue_days)} দিনের মধ্যে`, `Within ${num(data.overdue_days)} days`)} />
        <Tile label={t('AI-এর সাথে মিল', 'Agreed with AI')} value={pct(s.ai_agreement_pct)} note={t('বাকিগুলো কর্মকর্তা বদলেছেন', 'The rest the officer changed')} />
        <Tile label={t('পরামর্শ পাঠানো', 'Guidance sent')} value={num(s.guidance_sent)} note={s.guidance_done_pct === null ? undefined : t(`${num(s.guidance_done_pct)}% কৃষক সম্পন্ন করেছেন`, `${num(s.guidance_done_pct)}% finished by farmers`)} />
      </div>
      <div className="panels">
        <section className="card"><h2>{t('সাপ্তাহিক রিভিউ', 'Reviews per week')}</h2><Trend weeks={data.weeks} format={(v) => `${num(v)} ${t('টি রিভিউ', v === 1 ? 'review' : 'reviews')}`} /></section>
        <section className="card"><h2>{t('সিদ্ধান্তের ধরন', 'Verdicts given')}</h2><HealthBar health={data.verdicts} /></section>
      </div>
      <section className="card" style={{ marginTop: 12 }}>
        <h2>{t('সাম্প্রতিক কার্যক্রম', 'Recent activity')}</h2>
        <ActivityList entries={data.activity} />
      </section>
    </>
  )
}
