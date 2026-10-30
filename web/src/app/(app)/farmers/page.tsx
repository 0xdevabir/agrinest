'use client'

import { useState } from 'react'
import { Empty, Sheet, Skeletons } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'

type Farmer = { id: number; name: string; phone: string; village?: string; fields_count: number }

export default function FarmersPage() {
  const { t, num, toast } = useApp()
  const { data, error, reload } = useData<{ farmers: Farmer[]; stats: { farmers: number; lands: number } }>('/dashboard/agent')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', village: '' })
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setFormError('')
    try {
      const res = await api<{ linked: boolean }>('/agent/farmers', { body: form })
      toast(res.linked ? t('কৃষককে আপনার সাথে যুক্ত করা হলো', 'Farmer linked to you') : t('কৃষক যোগ হয়েছে। এবার ম্যাপে জমি আঁকুন।', 'Farmer added. Now draw their land on the map.'))
      setForm({ name: '', phone: '', village: '' })
      setAdding(false)
      await reload()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="row between">
        <h1 className="large-title">{t('আমার কৃষক', 'My farmers')}</h1>
        <button className="btn small" onClick={() => setAdding(true)}>➕ {t('নতুন', 'New')}</button>
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
              <span className="grow"><b>{f.name}</b><div className="sub small">{f.village ?? ''} · {num(f.fields_count)} {t('টি জমি', 'lands')}</div></span>
              <a className="btn small soft" href={`tel:${f.phone}`} aria-label={`${t('কল', 'Call')} ${f.name}`}>📞</a>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Sheet title={t('নতুন কৃষক', 'New farmer')} onClose={() => setAdding(false)}>
          <input className="input" maxLength={120} placeholder={t('নাম', 'Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" inputMode="tel" maxLength={20} placeholder={t('মোবাইল নম্বর', 'Mobile number')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" maxLength={120} placeholder={t('গ্রাম', 'Village')} value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
          {formError && <div className="notice high" role="alert">{formError}</div>}
          <button className="btn block" disabled={busy || !form.name.trim() || !form.phone.trim()} onClick={submit}>{busy ? '…' : t('যোগ করুন', 'Add')}</button>
        </Sheet>
      )}
    </div>
  )
}
