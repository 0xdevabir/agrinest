'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ReviewSheet } from '@/components/actions'
import { TrailSheet, useDuration, type Performance, type ReviewedScan } from '@/components/audit'
import { Tile } from '@/components/national'
import { Empty, HealthPill, Segmented, Skeletons, dateLabel } from '@/components/ui'
import { useApp, useData } from '@/lib/app'
import { HEALTH, type Health, type Scan } from '@/lib/types'

const HOUR = 3_600_000
const SEVERITY: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }

const ageHours = (s: Scan) => (Date.now() - new Date(s.created_at).getTime()) / HOUR

export default function ReviewsPage() {
  const { t, num, user } = useApp()
  const { data: perf, reload: reloadPerf } = useData<Performance>(user ? `/officers/${user.id}/performance` : null)
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const duration = useDuration()
  const s = perf?.stats

  return (
    <div className="page wide">
      <h1 className="large-title">{t('রিভিউ', 'Reviews')}</h1>
      <p className="sub">{user?.district ? t(`${user.district} জেলার স্ক্যান`, `Scans from ${user.district}`) : ' '}</p>

      {s && (
        <div className="tiles">
          <Tile label={t('রিভিউ বাকি', 'Waiting')} value={num(s.pending)} />
          <Tile label={t('দেরি হচ্ছে', 'Running late')} value={num(s.overdue)} note={t(`${num(perf.overdue_days)} দিনের বেশি`, `Over ${num(perf.overdue_days)} days`)} />
          <Tile label={t('আজ রিভিউ', 'Reviewed today')} value={num(s.reviewed_today)} />
          <Tile label={t('গড় সাড়ার সময়', 'Average response')} value={s.avg_hours_30d === null ? '–' : duration(s.avg_hours_30d)} note={t('গত ৩০ দিন', 'Last 30 days')} />
        </div>
      )}

      <div style={{ maxWidth: 360, marginTop: 16 }}>
        <Segmented value={tab} onChange={setTab} options={[{ id: 'queue', label: t('অপেক্ষায়', 'Waiting') }, { id: 'history', label: t('সম্পন্ন রেকর্ড', 'Completed record') }]} />
      </div>

      {tab === 'queue' ? <Queue overdueDays={perf?.overdue_days ?? 3} onReviewed={reloadPerf} /> : <History />}
    </div>
  )
}

function Queue({ overdueDays, onReviewed }: { overdueDays: number; onReviewed: () => void }) {
  const { t, num, lang } = useApp()
  const { data, error, reload } = useData<{ scans: Scan[] }>('/scans/queue')
  const [open, setOpen] = useState<Scan | null>(null)
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'urgent' | 'late'>('all')
  const [sort, setSort] = useState<'serious' | 'oldest' | 'newest'>('serious')
  const duration = useDuration()

  const scans = useMemo(() => {
    const term = q.trim().toLowerCase()
    const late = overdueDays * 24
    return (data?.scans ?? [])
      .filter((s) => show === 'all' || (show === 'urgent' ? s.ai.severity === 'high' : ageHours(s) > late))
      .filter((s) => !term || [s.field?.farmer?.name, s.field?.name, s.field?.village, s.ai.name_bn, s.ai.name_en].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => (sort === 'serious' ? (SEVERITY[a.ai.severity] ?? 4) - (SEVERITY[b.ai.severity] ?? 4) : 0) || (sort === 'newest' ? ageHours(a) - ageHours(b) : ageHours(b) - ageHours(a)))
  }, [data, q, show, sort, overdueDays])

  return (
    <>
      <div className="filters">
        <input className="input search" type="search" placeholder={t('কৃষক, জমি বা রোগ খুঁজুন', 'Search farmer, land or disease')} aria-label={t('খুঁজুন', 'Search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label={t('সাজান', 'Sort')} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="serious">{t('গুরুতর আগে', 'Most serious first')}</option>
          <option value="oldest">{t('পুরনো আগে', 'Oldest first')}</option>
          <option value="newest">{t('নতুন আগে', 'Newest first')}</option>
        </select>
        <div className="chips">
          {([['all', t('সব', 'All')], ['urgent', t('জরুরি', 'Urgent')], ['late', t('দেরি হচ্ছে', 'Running late')]] as const).map(([id, label]) => (
            <button key={id} className={`chip${show === id ? ' on' : ''}`} aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div className="notice high" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {!data && !error && <div style={{ marginTop: 12 }}><Skeletons /></div>}
      {data && !data.scans.length && <Empty icon="🎉">{t('সব রিভিউ শেষ!', 'All caught up!')}</Empty>}
      {data && data.scans.length > 0 && !scans.length && <Empty icon="🔍">{t('এই খোঁজে কোনো স্ক্যান নেই', 'No scans match this search')}</Empty>}

      <div className="queue">
        {scans.map((s) => {
          const age = ageHours(s)
          return (
            <article key={s.id} className="queue-row">
              {s.photos[0] ? <img className="thumb" src={s.photos[0]} alt="" loading="lazy" /> : <span className="thumb" aria-hidden>{s.field?.cycle?.emoji ?? '🌱'}</span>}
              <div className="grow" style={{ minWidth: 0 }}>
                <b className="truncate" style={{ display: 'block' }}>{s.field?.farmer?.name}, {s.field?.name}</b>
                <div className="sub small truncate">{lang === 'bn' ? s.ai.name_bn : s.ai.name_en} ({num(Math.round(s.ai.confidence * 100))}%){s.field?.village ? `, ${s.field.village}` : ''}</div>
                <div className="queue-meta">
                  {s.ai.severity === 'high' && <span className="flag high">⚠️ {t('জরুরি', 'Urgent')}</span>}
                  <span className={age > overdueDays * 24 ? 'flag high' : 'sub small'}>{t(`${duration(age)} ধরে অপেক্ষায়`, `Waiting ${duration(age)}`)}</span>
                  <span className="sub small">{dateLabel(s.created_at, lang)}</span>
                </div>
              </div>
              <button className="btn small" onClick={() => setOpen(s)}>{t('রিভিউ করুন', 'Review')}</button>
            </article>
          )
        })}
      </div>

      {open && <ReviewSheet scan={open} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await Promise.all([reload(), onReviewed()]) }} />}
    </>
  )
}

function History() {
  const { t, num, lang } = useApp()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [verdict, setVerdict] = useState<Health | ''>('')
  const [mine, setMine] = useState(false)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const duration = useDuration()

  useEffect(() => {
    const timer = setTimeout(() => { setTerm(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const query = new URLSearchParams({ page: String(page), ...(term && { q: term }), ...(verdict && { verdict }), ...(mine && { mine: '1' }) })
  const { data, error } = useData<{ scans: ReviewedScan[]; page: number; pages: number; total: number }>(`/scans/history?${query}`)
  // The previous results stay up while a new search loads.
  const last = useRef(data)
  if (data) last.current = data
  const shown = data ?? last.current

  return (
    <>
      <div className="filters">
        <input className="input search" type="search" placeholder={t('কৃষক বা জমি খুঁজুন', 'Search farmer or land')} aria-label={t('খুঁজুন', 'Search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label={t('সিদ্ধান্ত', 'Verdict')} value={verdict} onChange={(e) => { setVerdict(e.target.value as Health | ''); setPage(1) }}>
          <option value="">{t('সব সিদ্ধান্ত', 'All verdicts')}</option>
          {(['healthy', 'watch', 'treat', 'urgent'] as const).map((v) => <option key={v} value={v}>{t(HEALTH[v].bn, HEALTH[v].en)}</option>)}
        </select>
        <button className={`chip${mine ? ' on' : ''}`} aria-pressed={mine} onClick={() => { setMine(!mine); setPage(1) }}>{t('শুধু আমার', 'Only mine')}</button>
      </div>

      {error && <div className="notice high" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {!shown && !error && <div style={{ marginTop: 12 }}><Skeletons /></div>}
      {shown && !shown.scans.length && <Empty icon="📋">{t('এই খোঁজে কোনো রেকর্ড নেই', 'No records match this search')}</Empty>}

      {shown && shown.scans.length > 0 && (
        <>
          <div className="table-wrap card" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>{t('কৃষক ও জমি', 'Farmer and land')}</th><th>{t('AI-এর ধারণা', 'AI finding')}</th><th>{t('সিদ্ধান্ত', 'Verdict')}</th><th>{t('AI-এর সাথে', 'Against AI')}</th><th>{t('রিভিউ করেছেন', 'Reviewed by')}</th><th>{t('সাড়ার সময়', 'Response')}</th><th>{t('পরামর্শ', 'Guidance')}</th><th>{t('তারিখ', 'Date')}</th></tr></thead>
              <tbody>
                {shown.scans.map((s) => (
                  <tr key={s.id} className="row-open" onClick={() => setOpen(s.id)}>
                    <th scope="row">
                      <button className="who" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={(e) => { e.stopPropagation(); setOpen(s.id) }} aria-label={t(`${s.field?.farmer?.name}-এর স্ক্যানের রেকর্ড দেখুন`, `Open the record for ${s.field?.farmer?.name}`)}>
                        {s.photos[0] ? <img className="thumb small" src={s.photos[0]} alt="" loading="lazy" /> : <span className="thumb small" aria-hidden>{s.field?.cycle?.emoji ?? '🌱'}</span>}
                        <span><b>{s.field?.farmer?.name}</b><span className="sub small">{s.field?.name}</span></span>
                      </button>
                    </th>
                    <td>{lang === 'bn' ? s.ai.name_bn : s.ai.name_en}</td>
                    <td>{s.verdict && <HealthPill status={s.verdict} />}</td>
                    <td>{s.verdict === s.ai_verdict ? <span className="flag ok">✓ {t('মিল', 'Agreed')}</span> : <span className="flag warn">✎ {t('বদলেছেন', 'Changed')}</span>}</td>
                    <td>{s.reviewer ?? '–'}</td>
                    <td>{s.response_hours === null ? '–' : duration(s.response_hours)}</td>
                    <td>{!s.guidance ? '–' : s.guidance.done_at ? <span className="flag ok">✓ {t('সম্পন্ন', 'Finished')}</span> : <span className="sub small">{t('কৃষকের কাছে', 'With farmer')}</span>}</td>
                    <td>{s.reviewed_at ? dateLabel(s.reviewed_at, lang) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.pages > 1 && (
            <div className="pager">
              <button className="btn soft small" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('আগের', 'Previous')}</button>
              <span className="sub small">{t(`পাতা ${num(shown.page)} / ${num(shown.pages)}`, `Page ${num(shown.page)} of ${num(shown.pages)}`)}</span>
              <button className="btn soft small" disabled={page >= shown.pages} onClick={() => setPage(page + 1)}>{t('পরের', 'Next')}</button>
            </div>
          )}
        </>
      )}

      {open !== null && <TrailSheet scanId={open} onClose={() => setOpen(null)} />}
    </>
  )
}
