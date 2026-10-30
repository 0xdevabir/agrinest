'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import { HEALTH, type Crop, type Field, type Health, type Scan } from '@/lib/types'
import { HealthPill, Sheet, dateLabel } from './ui'

type ActionProps = { field: Field; onClose: () => void; onDone: () => void | Promise<void> }

function today() {
  return new Date().toLocaleDateString('en-CA')
}

/** Runs a save, reporting failures in place so the form keeps what was typed. */
function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return { busy, error, run }
}

const Err = ({ text }: { text: string }) => (text ? <div className="notice high" role="alert">{text}</div> : null)

/** Plants a crop, or corrects the one already growing when the land has one. */
export function PlantSheet({ field, onClose, onDone }: ActionProps) {
  const { t, pick, num, toast } = useApp()
  const { data } = useData<{ crops: Crop[] }>('/catalog')
  const growing = field.cycle
  const [crop, setCrop] = useState(growing?.crop ?? '')
  const [variety, setVariety] = useState(growing?.variety ?? '')
  const [sown, setSown] = useState(growing?.sown_on ?? today())
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    const body = { crop, variety: variety || null, sown_on: sown }
    if (growing) {
      await api(`/cycles/${growing.id}`, { method: 'PATCH', body })
      toast(`✅ ${t('ফসলের তথ্য হালনাগাদ হয়েছে', 'Crop updated')}`)
    } else {
      await api(`/fields/${field.id}/plant`, { body })
      toast(`🌱 ${t('ফসল লাগানো হয়েছে!', 'Crop planted!')} +${num(30)} XP`)
    }
    await onDone()
  })

  const remove = () => {
    if (!growing || !window.confirm(t('এই ফসল সরিয়ে ফেলবেন? ফসল তুলে থাকলে "ফসল তুলুন" ব্যবহার করুন।', 'Remove this crop? If you already harvested it, use Harvest instead.'))) return
    run(async () => {
      await api(`/cycles/${growing.id}`, { method: 'DELETE' })
      toast(t('ফসল সরানো হয়েছে', 'Crop removed'))
      await onDone()
    })
  }

  return (
    <Sheet title={growing ? t('ফসল সম্পাদনা', 'Edit crop') : t('কী লাগালেন?', 'What did you plant?')} subtitle={field.name} onClose={onClose}>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
        {(data?.crops ?? []).map((c) => (
          <button key={c.id} aria-pressed={crop === c.id} className="card" style={{ border: `2px solid ${crop === c.id ? 'var(--sage)' : 'transparent'}`, cursor: 'pointer', textAlign: 'center', padding: 10 }} onClick={() => setCrop(c.id)}>
            <div style={{ fontSize: 30 }} aria-hidden>{c.emoji}</div>
            <div className="small" style={{ fontWeight: 600 }}>{pick(c)}</div>
            <div className="sub" style={{ fontSize: 11 }}>{num(c.days)} {t('দিন', 'days')}</div>
          </button>
        ))}
      </div>
      <div><label className="lbl" htmlFor="sown">{t('কবে লাগিয়েছেন', 'Sowing date')}</label><input id="sown" className="input" type="date" max={today()} value={sown} onChange={(e) => setSown(e.target.value)} /></div>
      <div><label className="lbl" htmlFor="variety">{t('জাত (জানা থাকলে)', 'Variety (if known)')}</label><input id="variety" className="input" maxLength={80} placeholder={t('যেমন: ব্রি ধান২৮', 'e.g. BRRI dhan28')} value={variety} onChange={(e) => setVariety(e.target.value)} /></div>
      <Err text={error} />
      <button className="btn block" disabled={busy || !crop || !sown} onClick={submit}>{busy ? '…' : t('সংরক্ষণ করুন', 'Save')}</button>
      {growing && <button className="btn danger block" disabled={busy} onClick={remove}>{t('ফসল সরান', 'Remove crop')}</button>}
    </Sheet>
  )
}

export function EditLandSheet({ field, onClose, onDone, onRedraw, onRemove }: ActionProps & { onRedraw: () => void; onRemove: () => void }) {
  const { t, num, toast } = useApp()
  const [name, setName] = useState(field.name)
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    await api(`/fields/${field.id}`, { method: 'PATCH', body: { name: name.trim() } })
    toast(`✅ ${t('জমির নাম হালনাগাদ হয়েছে', 'Land name updated')}`)
    await onDone()
  })

  return (
    <Sheet title={t('জমি সম্পাদনা', 'Edit land')} subtitle={`${num(field.area_acres)} ${t('একর', 'acres')}`} onClose={onClose}>
      <div><label className="lbl" htmlFor="land-name">{t('জমির নাম', 'Land name')}</label><input id="land-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Err text={error} />
      <button className="btn block" disabled={busy || !name.trim() || name.trim() === field.name} onClick={submit}>{busy ? '…' : t('নাম সংরক্ষণ করুন', 'Save name')}</button>
      <button className="btn soft block" disabled={busy} onClick={onRedraw}>📐 {t('জমির সীমানা আবার আঁকুন', 'Redraw boundary')}</button>
      <button className="btn danger block" disabled={busy} onClick={onRemove}>{t('জমি মুছুন', 'Delete land')}</button>
    </Sheet>
  )
}

export function ScanSheet({ field, onClose, onDone }: ActionProps) {
  const { t, num, pick, toast } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [result, setResult] = useState<Scan | null>(null)
  const { busy, error, run } = useSubmit()

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  const submit = () => run(async () => {
    const form = new FormData()
    files.forEach((f) => form.append('photos[]', f))
    if (note.trim()) form.append('note', note.trim())
    const data = await api<{ scan: Scan }>(`/fields/${field.id}/scans`, { form })
    toast(`📸 ${t('ছবি পাঠানো হয়েছে', 'Photos sent')} +${num(20)} XP`)
    setResult(data.scan)
  })

  if (result) {
    return (
      <Sheet title={t('প্রাথমিক ফলাফল', 'First look')} subtitle={field.name} onClose={onDone}>
        <ScanCard scan={result} />
        <button className="btn block" onClick={onDone}>{t('ঠিক আছে', 'OK')}</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('ফসলের ছবি পাঠান', 'Send crop photos')} subtitle={`${field.name}${field.cycle ? ` · ${pick(field.cycle)}` : ''}`} onClose={onClose}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 6)); e.target.value = '' }} />
      {previews.length > 0 && (
        <div className="photos">
          {previews.map((p, i) => <img key={p} src={p} alt={`${t('ছবি', 'Photo')} ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} />)}
        </div>
      )}
      <button className="btn soft block" style={{ minHeight: previews.length ? 50 : 130, flexDirection: 'column' }} disabled={files.length >= 6} onClick={() => input.current?.click()}>
        {!previews.length && <span style={{ fontSize: 34 }} aria-hidden>📷</span>}
        {previews.length ? t('আরও ছবি তুলুন', 'Add more photos') : t('ছবি তুলুন (৬টি পর্যন্ত)', 'Take photos (up to 6)')}
      </button>
      <div className="sub small">{t('পাতার কাছ থেকে, আলোতে তুলুন। ছবিতে ট্যাপ করলে সরে যাবে।', 'Shoot leaves up close in good light. Tap a photo to remove it.')}</div>
      <textarea className="input" rows={2} maxLength={1000} placeholder={t('কোনো সমস্যা দেখছেন? (ঐচ্ছিক)', 'Noticed a problem? (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
      <Err text={error} />
      <button className="btn block" disabled={busy || !files.length} onClick={submit}>{busy ? t('দেখা হচ্ছে…', 'Checking…') : t('পাঠান', 'Send')}</button>
    </Sheet>
  )
}

export function HarvestSheet({ field, onClose, onDone }: ActionProps) {
  const { t, num, toast } = useApp()
  const [amount, setAmount] = useState('')
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    await api(`/cycles/${field.cycle!.id}/harvest`, { body: { actual_yield_kg: Number(amount) } })
    toast(`🌾 ${t('অভিনন্দন!', 'Congratulations!')} +${num(100)} XP`)
    await onDone()
  })

  return (
    <Sheet title={t('কত ফসল পেলেন?', 'How much did you harvest?')} subtitle={field.name} onClose={onClose}>
      <div className="sub">{t('এই তথ্য থেকে শিখে পরের মৌসুমে আপনার জমির হিসাব আরও ঠিক হবে।', 'This teaches the system your land, so next season is more accurate.')}</div>
      <div><label className="lbl" htmlFor="kg">{t('মোট ওজন (কেজি)', 'Total weight (kg)')}</label><input id="kg" className="input" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <Err text={error} />
      <button className="btn block" disabled={busy || amount === '' || Number(amount) < 0} onClick={submit}>{busy ? '…' : t('ফসল তোলা শেষ', 'Finish harvest')}</button>
    </Sheet>
  )
}

export function GuidanceSheet({ field, onClose, onDone }: ActionProps) {
  const { t, toast } = useApp()
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', due_on: '' })
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    await api(`/fields/${field.id}/guidance`, { body: { ...form, due_on: form.due_on || null } })
    toast(`✅ ${t('পরামর্শ পাঠানো হয়েছে', 'Guidance sent')}`)
    await onDone()
  })

  return (
    <Sheet title={t('কৃষককে পরামর্শ', 'Guidance for the farmer')} subtitle={`${field.farmer?.name ?? ''} · ${field.name}`} onClose={onClose}>
      <input className="input" maxLength={120} placeholder={t('কী করতে হবে (ছোট করে)', 'What to do (short)')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="input" rows={4} maxLength={2000} placeholder={t('বিস্তারিত', 'Details')} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      <div className="row">
        <button className={`chip${form.priority === 'urgent' ? ' on' : ''}`} style={{ background: form.priority === 'urgent' ? 'var(--urgent)' : undefined }} aria-pressed={form.priority === 'urgent'} onClick={() => setForm({ ...form, priority: form.priority === 'urgent' ? 'normal' : 'urgent' })}>🚨 {t('জরুরি', 'Urgent')}</button>
        <input className="input grow" type="date" min={today()} aria-label={t('শেষ তারিখ', 'Due date')} value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} />
      </div>
      <Err text={error} />
      <button className="btn block" disabled={busy || !form.title.trim() || !form.body.trim()} onClick={submit}>{busy ? '…' : t('পাঠান', 'Send')}</button>
    </Sheet>
  )
}

const VERDICTS: Exclude<Health, 'unknown'>[] = ['healthy', 'watch', 'treat', 'urgent']

export function ReviewSheet({ scan, onClose, onDone }: { scan: Scan; onClose: () => void; onDone: () => void | Promise<void> }) {
  const { t, lang, toast } = useApp()
  const suggested: Exclude<Health, 'unknown'> = ({ none: 'healthy', low: 'watch', medium: 'treat', high: 'urgent' } as const)[scan.ai.severity as 'none'] ?? 'watch'
  const [verdict, setVerdict] = useState<Exclude<Health, 'unknown'>>(suggested)
  const [title, setTitle] = useState(lang === 'bn' ? scan.ai.name_bn : scan.ai.name_en)
  const [body, setBody] = useState((lang === 'bn' ? scan.ai.steps_bn : scan.ai.steps_en).join('\n'))
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    await api(`/scans/${scan.id}/review`, { body: { verdict, title, body } })
    toast(`✅ ${t('রিভিউ পাঠানো হয়েছে', 'Review sent to the farmer')}`)
    await onDone()
  })

  return (
    <Sheet title={t('রিভিউ করুন', 'Review scan')} subtitle={scan.field ? `${scan.field.farmer?.name} · ${scan.field.name}` : undefined} onClose={onClose}>
      <ScanCard scan={scan} />
      <label className="lbl" style={{ marginBottom: -6 }}>{t('আপনার সিদ্ধান্ত', 'Your verdict')}</label>
      <div className="grid-2">
        {VERDICTS.map((v) => (
          <button key={v} aria-pressed={verdict === v} className="btn small" style={{ background: verdict === v ? HEALTH[v].color : `${HEALTH[v].color}22`, color: verdict === v ? '#fff' : HEALTH[v].color }} onClick={() => setVerdict(v)}>{t(HEALTH[v].bn, HEALTH[v].en)}</button>
        ))}
      </div>
      <input className="input" maxLength={120} aria-label={t('শিরোনাম', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" rows={5} maxLength={2000} aria-label={t('পরামর্শ', 'Guidance')} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="sub small">{t('AI-এর খসড়া থেকে শুরু। পাঠানোর আগে সংশোধন করুন।', "Pre-filled from the AI draft. Correct it before sending.")}</div>
      <Err text={error} />
      <button className="btn block" disabled={busy || !title.trim() || !body.trim()} onClick={submit}>{busy ? '…' : t('কৃষককে পাঠান', 'Send to farmer')}</button>
    </Sheet>
  )
}

export function ScanCard({ scan, action }: { scan: Scan; action?: ReactNode }) {
  const { t, lang, num } = useApp()
  const ai = scan.ai
  const name = lang === 'bn' ? ai.name_bn : ai.name_en
  const summary = lang === 'bn' ? ai.summary_bn : ai.summary_en
  const steps = lang === 'bn' ? ai.steps_bn : ai.steps_en
  const quick = ai.source !== 'nova'

  return (
    <div className="card stack">
      <div className="row between">
        <div className="sub small">{dateLabel(scan.created_at, lang)}{scan.submitted_by ? ` · ${scan.submitted_by}` : ''}</div>
        {scan.status === 'reviewed' && scan.verdict
          ? <HealthPill status={scan.verdict} />
          : <span className="pill" style={{ background: 'var(--cream)' }}>⏳ {t('কর্মকর্তার অপেক্ষায়', 'Awaiting officer')}</span>}
      </div>
      {scan.photos.length > 0 && <div className="photos">{scan.photos.map((p) => <img key={p} src={p} alt="" loading="lazy" />)}</div>}
      <div>
        <div className="row between"><b>{name}</b><span className="sub small">{quick ? t('রঙ যাচাই', 'Colour check') : 'Nova AI'} · {num(Math.round(ai.confidence * 100))}%</span></div>
        {summary && <div className="sub" style={{ marginTop: 2 }}>{summary}</div>}
      </div>
      {steps.length > 0 && <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>{steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      {scan.note && <div className="small" style={{ fontStyle: 'italic' }}>“{scan.note}”</div>}
      <div className="sub small">{lang === 'bn' ? ai.chemical_note_bn : ai.chemical_note_en}</div>
      {action}
    </div>
  )
}
