'use client'

import { useEffect, useRef, useState } from 'react'
import { ChainCheck, ChangesTable, actionLabel, useStamp, type AuditEntry } from '@/components/audit'
import { Mark } from '@/components/picture'
import { Empty, Sheet, Skeletons } from '@/components/ui'
import { getToken } from '@/lib/api'
import { useApp, useData } from '@/lib/app'

const ENTITIES: [string, string, string][] = [
  ['auth', 'সাইন ইন', 'Sign-ins'],
  ['user', 'অ্যাকাউন্ট', 'Accounts'],
  ['field', 'জমি', 'Land'],
  ['crop_cycle', 'ফসল', 'Crops'],
  ['scan', 'স্ক্যান', 'Scans'],
  ['guidance', 'পরামর্শ', 'Guidance'],
  ['listing', 'বিক্রির তালিকা', 'Listings'],
  ['buy_post', 'ক্রয় পোস্ট', 'Buy posts'],
  ['offer', 'দরপ্রস্তাব', 'Offers'],
  ['offer_round', 'দর আলোচনা', 'Negotiation'],
  ['audit', 'অডিট', 'Audit'],
]

type Result = { entries: AuditEntry[]; page: number; pages: number; total: number; districts: string[] }

export default function AuditPage() {
  const { t, num, user, toast } = useApp()
  const stamp = useStamp()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [filters, setFilters] = useState({ entity: '', district: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const [exporting, setExporting] = useState(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const timer = setTimeout(() => { setTerm(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const set = (key: keyof typeof filters, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1) }
  const params = new URLSearchParams(Object.entries({ q: term, ...filters }).filter(([, v]) => v))
  const { data, error } = useData<Result>(isAdmin ? `/audit?${params}&page=${page}` : null)
  // The previous results stay up while a new search loads.
  const last = useRef(data)
  if (data) last.current = data
  const shown = data ?? last.current

  // A link can't carry the sign-in token, so the file is fetched and handed to the browser.
  const download = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/audit/export?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new Error()
      const name = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? 'agrinest-audit.csv'
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast(t('ডাউনলোড হয়নি, আবার চেষ্টা করুন', 'The download failed. Try again.'))
    } finally {
      setExporting(false)
    }
  }

  if (!isAdmin) return <div className="page"><Empty icon={<Mark name="lock" frame="empty" />}>{t('এই পাতা শুধু জাতীয় প্রশাসকের জন্য', 'This page is for national admins')}</Empty></div>

  return (
    <div className="page wide">
      <div className="head-row">
        <div>
          <h1 className="large-title">{t('অডিট রেকর্ড', 'Audit record')}</h1>
          <p className="sub">{shown ? t(`${num(shown.total)}টি এন্ট্রি। এই রেকর্ড বদলানো বা মোছা যায় না।`, `${num(shown.total)} entries. This record can't be edited or deleted from the app.`) : ' '}</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <ChainCheck />
          <button className="btn small" disabled={exporting} onClick={download}>{exporting ? '…' : t('CSV ডাউনলোড', 'Download CSV')}</button>
        </div>
      </div>

      <div className="filters">
        <input className="input search" type="search" placeholder={t('ব্যক্তি, জমি বা কাজ খুঁজুন', 'Search person, land or action')} aria-label={t('খুঁজুন', 'Search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label={t('ধরন', 'Type')} value={filters.entity} onChange={(e) => set('entity', e.target.value)}>
          <option value="">{t('সব ধরন', 'All types')}</option>
          {ENTITIES.map(([id, bn, en]) => <option key={id} value={id}>{t(bn, en)}</option>)}
        </select>
        <select className="input" aria-label={t('জেলা', 'District')} value={filters.district} onChange={(e) => set('district', e.target.value)}>
          <option value="">{t('সব জেলা', 'All districts')}</option>
          {shown?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="input" type="date" aria-label={t('শুরুর তারিখ', 'From date')} value={filters.from} onChange={(e) => set('from', e.target.value)} />
        <input className="input" type="date" aria-label={t('শেষ তারিখ', 'To date')} value={filters.to} onChange={(e) => set('to', e.target.value)} />
      </div>

      {error && <div className="notice high" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {!shown && !error && <div style={{ marginTop: 12 }}><Skeletons n={5} /></div>}
      {shown && !shown.entries.length && <Empty icon={<Mark name="clipboard" frame="empty" />}>{t('এই খোঁজে কোনো এন্ট্রি নেই', 'No entries match this search')}</Empty>}

      {shown && shown.entries.length > 0 && (
        <>
          <div className="table-wrap card" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>{t('সময়', 'Time')}</th><th>{t('কাজ', 'Action')}</th><th>{t('কে', 'Who')}</th><th>{t('কিসে', 'On')}</th><th>{t('জেলা', 'District')}</th><th>{t('আইপি', 'IP')}</th></tr></thead>
              <tbody>
                {shown.entries.map((e) => (
                  <tr key={e.id} className="row-open" onClick={() => setOpen(e)}>
                    <th scope="row"><button style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={(ev) => { ev.stopPropagation(); setOpen(e) }}>{stamp(e.at)}</button></th>
                    <td>{e.action === 'auth.login_failed' ? <span className="flag high">⚠️ {actionLabel(e.action, t)}</span> : actionLabel(e.action, t)}</td>
                    <td>{e.actor ?? <span className="sub">{t('অজানা বা সিস্টেম', 'Unknown or system')}</span>}{e.role && <div className="sub small">{e.role}</div>}</td>
                    <td>{e.subject ?? '–'}</td>
                    <td>{e.district ?? '–'}</td>
                    <td>{e.ip ?? '–'}</td>
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

      {open && (
        <Sheet title={actionLabel(open.action, t)} subtitle={stamp(open.at)} onClose={() => setOpen(null)}>
          <div className="card">
            <dl className="facts">
              <dt>{t('এন্ট্রি', 'Entry')}</dt><dd>#{num(open.id)}</dd>
              <dt>{t('কে', 'Who')}</dt><dd>{open.actor ?? t('অজানা বা সিস্টেম', 'Unknown or system')}{open.role ? ` (${open.role})` : ''}</dd>
              {open.subject && <><dt>{t('কিসে', 'On')}</dt><dd>{open.subject}</dd></>}
              {open.district && <><dt>{t('জেলা', 'District')}</dt><dd>{open.district}</dd></>}
              <dt>{t('আইপি', 'IP')}</dt><dd>{open.ip ?? '–'}</dd>
              {open.user_agent && <><dt>{t('ডিভাইস', 'Device')}</dt><dd className="small">{open.user_agent}</dd></>}
            </dl>
          </div>
          {open.changes && <div className="card"><ChangesTable changes={open.changes} /></div>}
          {open.hash && <p className="hash">{t('যাচাই কোড', 'Check code')}: {open.hash}</p>}
        </Sheet>
      )}
    </div>
  )
}
