'use client'

import { useState } from 'react'
import { ReviewSheet, ScanCard } from '@/components/actions'
import { Empty, Skeletons } from '@/components/ui'
import { useApp, useData } from '@/lib/app'
import type { Scan } from '@/lib/types'

export default function ReviewsPage() {
  const { t, num } = useApp()
  const { data, error, reload } = useData<{ scans: Scan[] }>('/scans/queue')
  const [open, setOpen] = useState<Scan | null>(null)

  return (
    <div className="page">
      <h1 className="large-title">{t('রিভিউ', 'Reviews')}</h1>
      <p className="sub" style={{ marginBottom: 16 }}>{data ? `${num(data.scans.length)} ${t('টি স্ক্যান অপেক্ষায়, জরুরিগুলো আগে', 'waiting, most serious first')}` : ' '}</p>
      {error && <div className="notice high" role="alert">{error}</div>}
      {!data && !error && <Skeletons />}
      {data && !data.scans.length && <Empty icon="🎉">{t('সব রিভিউ শেষ!', 'All caught up!')}</Empty>}
      <div className="stack">
        {data?.scans.map((s) => (
          <div key={s.id}>
            <div className="row" style={{ padding: '0 4px 6px' }}>
              <span aria-hidden>{s.field?.cycle?.emoji}</span>
              <b className="grow truncate">{s.field?.farmer?.name} · {s.field?.name}</b>
              <span className="sub small">{s.field?.village}</span>
            </div>
            <ScanCard scan={s} action={<button className="btn block" onClick={() => setOpen(s)}>🔬 {t('রিভিউ করুন', 'Review')}</button>} />
          </div>
        ))}
      </div>
      {open && <ReviewSheet scan={open} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await reload() }} />}
    </div>
  )
}
