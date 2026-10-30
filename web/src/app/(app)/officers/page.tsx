'use client'

import Link from 'next/link'
import { useNational } from '@/components/national'
import { Empty, Skeletons, dateLabel } from '@/components/ui'
import { useApp } from '@/lib/app'

export default function OfficersPage() {
  const { t, num, lang, user } = useApp()
  const { data, error } = useNational()

  if (user?.role !== 'admin') return <div className="page"><Empty icon="🔒">{t('এই পাতা শুধু জাতীয় প্রশাসকের জন্য', 'This page is for national admins')}</Empty></div>
  if (error) return <div className="page wide"><div className="notice high" role="alert">{error}</div></div>
  if (!data) return <div className="page wide"><Skeletons n={4} /></div>

  const behind = data.officers.filter((o) => o.behind).length
  return (
    <div className="page wide">
      <h1 className="large-title">{t('কর্মকর্তা', 'Officers')}</h1>
      <p className="sub">{t(`${num(data.officers.length)} জনের মধ্যে ${num(behind)} জন পিছিয়ে। ${num(data.overdue_days)} দিনের বেশি পুরনো স্ক্যান থাকলে পিছিয়ে ধরা হয়।`, `${num(behind)} of ${num(data.officers.length)} behind. An officer is behind when a scan in their district waits over ${num(data.overdue_days)} days.`)}</p>

      {data.officers.length === 0 ? <Empty icon="👥">{t('এখনো কোনো কর্মকর্তা নেই', 'No officers yet')}</Empty> : (
        <div className="table-wrap card" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>{t('কর্মকর্তা', 'Officer')}</th><th>{t('অবস্থা', 'Status')}</th><th>{t('জেলা', 'District')}</th><th>{t('রিভিউ বাকি', 'Waiting')}</th><th>{t('৭ দিনে রিভিউ', 'Reviewed, 7 days')}</th><th>{t('৩০ দিনে রিভিউ', 'Reviewed, 30 days')}</th><th>{t('গড় সময়', 'Avg review time')}</th><th>{t('পরামর্শ', 'Guidance sent')}</th><th>{t('শেষ রিভিউ', 'Last review')}</th></tr></thead>
            <tbody>
              {data.officers.map((o) => (
                <tr key={o.id}>
                  <th scope="row"><Link href={`/officers/${o.id}`} style={{ color: 'var(--sage)', textDecoration: 'underline' }}>{o.name}</Link><a className="sub small officer-tel" href={`tel:${o.phone}`}>{num(o.phone)}</a></th>
                  <td>{o.behind ? <span className="flag high">⚠️ {t('পিছিয়ে', 'Behind')}</span> : <span className="flag ok">✓ {t('ঠিক আছে', 'On track')}</span>}</td>
                  <td>{o.district ?? '–'}</td>
                  <td>{num(o.pending)}{o.overdue > 0 && <span className="flag high"> {num(o.overdue)} {t('দেরি', 'late')}</span>}</td>
                  <td>{num(o.reviewed_7d)}</td>
                  <td>{num(o.reviewed_30d)}</td>
                  <td>{o.avg_review_hours === null ? '–' : `${num(o.avg_review_hours)} ${t('ঘণ্টা', 'hrs')}`}</td>
                  <td>{num(o.guidance_30d)}</td>
                  <td>{o.last_review_at ? dateLabel(o.last_review_at, lang) : t('নেই', 'None')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
