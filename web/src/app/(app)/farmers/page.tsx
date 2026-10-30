'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FarmerForm } from '@/components/actions'
import { Empty, FlowDone, Sheet, Skeletons, StepBar } from '@/components/ui'
import { useApp, useData } from '@/lib/app'

type Farmer = { id: number; name: string; phone: string; village?: string; fields_count: number }

export default function FarmersPage() {
  const { t, num } = useApp()
  const { data, error, reload } = useData<{ farmers: Farmer[]; stats: { farmers: number; lands: number } }>('/dashboard/agent')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<{ id: number; name: string; linked: boolean } | null>(null)
  const steps = [t('তথ্য', 'Details'), t('জমি', 'Land')]
  const close = () => { setAdding(false); setAdded(null) }

  return (
    <div className="page">
      <div className="row between">
        <h1 className="large-title">{t('আমার কৃষক', 'My farmers')}</h1>
        <button className="btn small" onClick={() => setAdding(true)}>➕ {t('নতুন কৃষক', 'New farmer')}</button>
      </div>
      <p className="sub" style={{ marginBottom: 16 }}>{data ? `${num(data.stats.farmers)} ${t('জন কৃষক', 'farmers')} · ${num(data.stats.lands)} ${t('টি জমি', 'lands')}` : ' '}</p>
      {error && <div className="notice high" role="alert">{error}</div>}
      {!data && !error && <Skeletons />}
      {data && !data.farmers.length && <Empty icon="🧑‍🌾">{t('প্রথম কৃষক যোগ করুন', 'Add your first farmer')}</Empty>}
      {data && data.farmers.length > 0 && (
        <div className="group">
          {data.farmers.map((f) => (
            <div className="cell" key={f.id}>
              <span className="icon-tile" aria-hidden>🧑‍🌾</span>
              <span className="grow"><b>{f.name}</b><div className="sub small">{f.village ?? ''} · {f.fields_count ? `${num(f.fields_count)} ${t('টি জমি', 'lands')}` : t('জমি যোগ হয়নি', 'No land yet')}</div></span>
              <Link className={`btn small${f.fields_count ? ' soft' : ''}`} href={`/?addLandFor=${f.id}`}>➕ {t('জমি', 'Land')}</Link>
              <a className="btn small soft" href={`tel:${f.phone}`} aria-label={`${t('কল', 'Call')} ${f.name}`}>📞</a>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Sheet title={t('নতুন কৃষক', 'New farmer')} onClose={close}>
          {added ? (
            <>
              <StepBar steps={steps} step={2} title={t('এবার জমি যোগ করুন', 'Now add their land')} />
              <FlowDone icon="🧑‍🌾" title={added.linked ? t(`${added.name} আপনার সাথে যুক্ত হয়েছেন`, `${added.name} is linked to you`) : t(`${added.name} যোগ হয়েছেন`, `${added.name} is added`)} body={t('জমি যোগ করলে ফসল ও ভিজিটের হিসাব শুরু হবে।', 'Adding land starts their crop and visit tracking.')}>
                <Link className="btn block" href={`/?addLandFor=${added.id}`}>📍 {t('জমি আঁকুন', 'Draw their land')}</Link>
                <button className="btn soft block" onClick={() => setAdded(null)}>➕ {t('আরেকজন কৃষক যোগ করুন', 'Add another farmer')}</button>
                <button className="btn soft block" onClick={close}>{t('এখন শেষ', 'Done for now')}</button>
              </FlowDone>
            </>
          ) : (
            <>
              <StepBar steps={steps} step={1} title={t('কৃষকের তথ্য দিন', "Enter the farmer's details")} hint={t('নাম ও মোবাইল নম্বর লাগবে। এরপর জমি যোগ করবেন।', 'Name and mobile number are required. You add their land next.')} />
              <FarmerForm label={`${t('যোগ করুন', 'Add farmer')} →`} onDone={async (f, linked) => { setAdded({ ...f, linked }); await reload() }} />
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
