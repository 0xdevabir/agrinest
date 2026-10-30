'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PerformancePanel, type Performance } from '@/components/audit'
import { Mark } from '@/components/picture'
import { Empty, Skeletons, dateLabel } from '@/components/ui'
import { useApp, useData } from '@/lib/app'

export default function OfficerPage() {
  const { t, num, lang, user } = useApp()
  const { id } = useParams<{ id: string }>()
  const isAdmin = user?.role === 'admin'
  const { data, error } = useData<Performance>(isAdmin ? `/officers/${id}/performance` : null)

  if (!isAdmin) return <div className="page"><Empty icon={<Mark name="lock" frame="empty" />}>{t('এই পাতা শুধু জাতীয় প্রশাসকের জন্য', 'This page is for national admins')}</Empty></div>

  const o = data?.officer
  return (
    <div className="page wide">
      <Link className="sub small" href="/officers">‹ {t('সব কর্মকর্তা', 'All officers')}</Link>
      {error && <div className="notice high" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {!data && !error && <div style={{ marginTop: 12 }}><Skeletons n={4} /></div>}
      {o && data && (
        <>
          <h1 className="large-title">{o.name}</h1>
          <p className="sub">
            {[o.organization, o.district, o.upazila].filter(Boolean).join(', ')}
            {' '}<a href={`tel:${o.phone}`}>{num(o.phone)}</a>
            {o.since && <> {t(`${dateLabel(o.since, lang)} থেকে যুক্ত`, `Joined ${dateLabel(o.since, lang)}`)}</>}
          </p>
          <PerformancePanel data={data} />
        </>
      )}
    </div>
  )
}
