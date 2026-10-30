'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useApp, useData } from '@/lib/app'
import { HEALTH, type Crop, type Field, type Health, type Scan } from '@/lib/types'
import { FlowDone, HealthPill, Sheet, StepBar, StepNav, dateLabel } from './ui'

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

/** The form an agent fills to register a farmer. */
export function FarmerForm({ label, onBack, onDone }: { label: ReactNode; onBack?: () => void; onDone: (farmer: { id: number; name: string }, linked: boolean) => void | Promise<void> }) {
  const { t } = useApp()
  const [form, setForm] = useState({ name: '', phone: '', village: '' })
  const { busy, error, run } = useSubmit()

  const submit = () => run(async () => {
    const res = await api<{ farmer: { id: number; name: string }; linked: boolean }>('/agent/farmers', { body: form })
    await onDone(res.farmer, res.linked)
  })

  return (
    <>
      <div><label className="lbl" htmlFor="farmer-name">{t('কৃষকের নাম', "Farmer's name")}</label><input id="farmer-name" className="input" autoFocus maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="lbl" htmlFor="farmer-phone">{t('মোবাইল নম্বর', 'Mobile number')}</label><input id="farmer-phone" className="input" inputMode="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div><label className="lbl" htmlFor="farmer-village">{t('গ্রাম', 'Village')}</label><input id="farmer-village" className="input" maxLength={120} value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} /></div>
      <Err text={error} />
      <StepNav onBack={onBack} onNext={submit} disabled={!form.name.trim() || !form.phone.trim()} busy={busy} label={label} />
    </>
  )
}

/**
 * Plants a crop in two steps, or corrects the one already growing on a single form.
 * Inside a longer flow, `flow` supplies its steps and `onClose` skips planting for now.
 */
export function PlantSheet({ field, flow, onClose, onDone, onPhotos }: ActionProps & { flow?: { steps: string[]; step: number }; onPhotos?: () => void }) {
  const { t, pick, num, toast } = useApp()
  const { data } = useData<{ crops: Crop[] }>('/catalog')
  const growing = field.cycle
  const [crop, setCrop] = useState(growing?.crop ?? '')
  const [variety, setVariety] = useState(growing?.variety ?? '')
  const [sown, setSown] = useState(growing?.sown_on ?? today())
  const [stage, setStage] = useState<'crop' | 'date' | 'done'>('crop')
  const { busy, error, run } = useSubmit()
  const steps = flow?.steps ?? [t('ফসল', 'Crop'), t('তারিখ', 'Date'), t('শেষ', 'Finish')]
  const chosen = data?.crops.find((c) => c.id === crop)

  const submit = () => run(async () => {
    const body = { crop, variety: variety || null, sown_on: sown }
    if (growing) {
      await api(`/cycles/${growing.id}`, { method: 'PATCH', body })
      toast(`✅ ${t('ফসলের তথ্য হালনাগাদ হয়েছে', 'Crop updated')}`)
      await onDone()
      return
    }
    await api(`/fields/${field.id}/plant`, { body })
    toast(`🌱 ${t('ফসল লাগানো হয়েছে!', 'Crop planted!')} +${num(30)} XP`)
    if (flow) await onDone()
    else setStage('done')
  })

  const remove = () => {
    if (!growing || !window.confirm(t('এই ফসল সরিয়ে ফেলবেন? ফসল তুলে থাকলে "ফসল তুলুন" ব্যবহার করুন।', 'Remove this crop? If you already harvested it, use Harvest instead.'))) return
    run(async () => {
      await api(`/cycles/${growing.id}`, { method: 'DELETE' })
      toast(t('ফসল সরানো হয়েছে', 'Crop removed'))
      await onDone()
    })
  }

  const cropGrid = (
    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
      {(data?.crops ?? []).map((c) => (
        <button key={c.id} aria-pressed={crop === c.id} className="card" style={{ border: `2px solid ${crop === c.id ? 'var(--sage)' : 'transparent'}`, cursor: 'pointer', textAlign: 'center', padding: 10 }} onClick={() => { setCrop(c.id); if (!growing) setStage('date') }}>
          <div style={{ fontSize: 30 }} aria-hidden>{c.emoji}</div>
          <div className="small" style={{ fontWeight: 600 }}>{pick(c)}</div>
          <div className="sub" style={{ fontSize: 11 }}>{num(c.days)} {t('দিন', 'days')}</div>
        </button>
      ))}
    </div>
  )
  const dateFields = (
    <>
      <div><label className="lbl" htmlFor="sown">{t('কবে লাগিয়েছেন', 'Sowing date')}</label><input id="sown" className="input" type="date" max={today()} value={sown} onChange={(e) => setSown(e.target.value)} /></div>
      <div><label className="lbl" htmlFor="variety">{t('জাত (জানা থাকলে)', 'Variety (if known)')}</label><input id="variety" className="input" maxLength={80} placeholder={t('যেমন: ব্রি ধান২৮', 'e.g. BRRI dhan28')} value={variety} onChange={(e) => setVariety(e.target.value)} /></div>
    </>
  )

  if (growing) {
    return (
      <Sheet title={t('ফসল সম্পাদনা', 'Edit crop')} subtitle={field.name} onClose={onClose}>
        {cropGrid}
        {dateFields}
        <Err text={error} />
        <button className="btn block" disabled={busy || !crop || !sown} onClick={submit}>{busy ? '…' : t('সংরক্ষণ করুন', 'Save')}</button>
        <button className="btn danger block" disabled={busy} onClick={remove}>{t('ফসল সরান', 'Remove crop')}</button>
      </Sheet>
    )
  }

  if (stage === 'done') {
    return (
      <Sheet title={t('ফসল লাগানো হয়েছে', 'Crop planted')} subtitle={field.name} onClose={onDone}>
        <StepBar steps={steps} step={3} title={t('সব ঠিক আছে', 'All set')} />
        <FlowDone icon="🌱" title={`${chosen ? pick(chosen) : ''} ${t('যোগ হয়েছে', 'added')}`} body={t('এখন ফসলের ছবি পাঠান, যাতে ফসলের অবস্থা দেখা যায়।', 'Now send crop photos so its health can be checked.')}>
          {onPhotos && <button className="btn block" onClick={onPhotos}>📸 {t('ছবি পাঠান', 'Send photos')}</button>}
          <button className="btn soft block" onClick={onDone}>{t('এখন শেষ', 'Done for now')}</button>
        </FlowDone>
      </Sheet>
    )
  }

  const step = flow?.step ?? (stage === 'crop' ? 1 : 2)
  return (
    <Sheet title={t('ফসলের তথ্য', 'Crop details')} subtitle={field.name} onClose={onClose}>
      {stage === 'crop' ? (
        <>
          <StepBar steps={steps} step={step} title={t('কী ফসল লাগিয়েছেন?', 'What is planted here?')} hint={t('ফসলে ট্যাপ করুন', 'Tap the crop')} />
          {cropGrid}
          {flow && <button className="btn soft block" onClick={onClose}>{t('এখনো লাগানো হয়নি, পরে দেব', 'Not planted yet, add it later')}</button>}
        </>
      ) : (
        <>
          <StepBar steps={steps} step={step} title={`${chosen ? `${chosen.emoji} ${pick(chosen)}: ` : ''}${t('কবে লাগিয়েছেন?', 'When was it sown?')}`} hint={t('তারিখ দিন। জাত জানা না থাকলে খালি রাখুন।', 'Set the date. Leave the variety empty if unknown.')} />
          {dateFields}
          <Err text={error} />
          <StepNav onBack={() => setStage('crop')} onNext={submit} disabled={!crop || !sown} busy={busy} label={`✓ ${t('ফসল সংরক্ষণ করুন', 'Save crop')}`} />
        </>
      )}
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

/** Photos, then an optional note, then the first result and what happens after it. */
export function ScanSheet({ field, onClose, onDone }: ActionProps) {
  const { t, num, pick, toast } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [noting, setNoting] = useState(false)
  const [result, setResult] = useState<Scan | null>(null)
  const { busy, error, run } = useSubmit()
  const steps = [t('ছবি', 'Photos'), t('সমস্যা', 'Problem'), t('ফলাফল', 'Result')]

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
        <StepBar steps={steps} step={3} title={t('প্রাথমিক ফলাফল দেখুন', 'Check the first result')} hint={t('এরপর কর্মকর্তা যাচাই করে এই জমিতে পরামর্শ পাঠাবেন।', 'Next, an officer checks this and sends guidance to this land.')} />
        <ScanCard scan={result} />
        <button className="btn block" onClick={onDone}>{t('ঠিক আছে', 'OK')}</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('ফসলের ছবি পাঠান', 'Send crop photos')} subtitle={`${field.name}${field.cycle ? ` · ${pick(field.cycle)}` : ''}`} onClose={onClose}>
      {noting ? (
        <>
          <StepBar steps={steps} step={2} title={t('কোনো সমস্যা দেখছেন?', 'Noticed a problem?')} hint={t('লিখতে পারেন, না চাইলে খালি রেখে পাঠান।', 'Write it here, or leave it empty and send.')} />
          <textarea className="input" rows={3} maxLength={1000} aria-label={t('সমস্যার বিবরণ', 'Describe the problem')} value={note} onChange={(e) => setNote(e.target.value)} />
          <Err text={error} />
          <StepNav onBack={() => setNoting(false)} onNext={submit} busy={busy} label={`${t('পাঠান', 'Send')} →`} />
        </>
      ) : (
        <>
          <StepBar steps={steps} step={1} title={t('ফসলের ছবি তুলুন', 'Take crop photos')} hint={t('পাতার কাছ থেকে, আলোতে তুলুন। ছবিতে ট্যাপ করলে সরে যাবে।', 'Shoot leaves up close in good light. Tap a photo to remove it.')} />
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
          <StepNav onNext={() => setNoting(true)} disabled={!files.length} />
        </>
      )}
    </Sheet>
  )
}

/** Records the weight, then points to selling the crop or planting the next one. */
export function HarvestSheet({ field, onClose, onDone, onPlant }: ActionProps & { onPlant: () => void }) {
  const { t, num, toast, user } = useApp()
  const [amount, setAmount] = useState('')
  const [finished, setFinished] = useState(false)
  const { busy, error, run } = useSubmit()
  const steps = [t('ওজন', 'Weight'), t('শেষ', 'Finish')]

  const submit = () => run(async () => {
    await api(`/cycles/${field.cycle!.id}/harvest`, { body: { actual_yield_kg: Number(amount) } })
    toast(`🌾 ${t('অভিনন্দন!', 'Congratulations!')} +${num(100)} XP`)
    setFinished(true)
  })

  if (finished) {
    return (
      <Sheet title={t('ফসল তোলা শেষ', 'Harvest finished')} subtitle={field.name} onClose={onDone}>
        <StepBar steps={steps} step={2} title={t('এরপর কী করবেন?', 'What next?')} />
        <FlowDone icon="🌾" title={`${num(Number(amount))} ${t('কেজি লেখা হয়েছে', 'kg recorded')}`} body={t('এই তথ্য থেকে পরের মৌসুমের হিসাব আরও ঠিক হবে।', 'This makes next season\'s estimate more accurate.')}>
          {user?.role === 'farmer' && <Link href="/market" className="btn block">🛒 {t('ফসল বিক্রি করুন', 'Sell this crop')}</Link>}
          <button className={`btn block${user?.role === 'farmer' ? ' soft' : ''}`} onClick={onPlant}>🌱 {t('নতুন ফসল লাগান', 'Plant the next crop')}</button>
          <button className="btn soft block" onClick={onDone}>{t('এখন শেষ', 'Done for now')}</button>
        </FlowDone>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('ফসল তুলুন', 'Harvest')} subtitle={field.name} onClose={onClose}>
      <StepBar steps={steps} step={1} title={t('কত ফসল পেলেন?', 'How much did you harvest?')} hint={t('এই তথ্য থেকে শিখে পরের মৌসুমে আপনার জমির হিসাব আরও ঠিক হবে।', 'This teaches the system your land, so next season is more accurate.')} />
      <div><label className="lbl" htmlFor="kg">{t('মোট ওজন (কেজি)', 'Total weight (kg)')}</label><input id="kg" className="input" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <Err text={error} />
      <StepNav onNext={submit} disabled={amount === '' || Number(amount) < 0} busy={busy} label={`✓ ${t('ফসল তোলা শেষ', 'Finish harvest')}`} />
    </Sheet>
  )
}

export function GuidanceSheet({ field, onClose, onDone }: ActionProps) {
  const { t } = useApp()
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', due_on: '' })
  const [stage, setStage] = useState(1)
  const { busy, error, run } = useSubmit()
  const steps = [t('পরামর্শ', 'Advice'), t('সময়', 'Timing'), t('শেষ', 'Finish')]
  const who = field.farmer?.name ?? t('কৃষক', 'The farmer')

  const submit = () => run(async () => {
    await api(`/fields/${field.id}/guidance`, { body: { ...form, due_on: form.due_on || null } })
    setStage(3)
  })

  return (
    <Sheet title={t('কৃষককে পরামর্শ', 'Guidance for the farmer')} subtitle={`${field.farmer?.name ?? ''} · ${field.name}`} onClose={stage === 3 ? onDone : onClose}>
      {stage === 1 && (
        <>
          <StepBar steps={steps} step={1} title={t('কৃষককে কী করতে হবে?', 'What should the farmer do?')} hint={t('ছোট শিরোনাম ও বিস্তারিত লিখুন', 'Write a short title and the details')} />
          <input className="input" maxLength={120} placeholder={t('কী করতে হবে (ছোট করে)', 'What to do (short)')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input" rows={4} maxLength={2000} placeholder={t('বিস্তারিত', 'Details')} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <StepNav onNext={() => setStage(2)} disabled={!form.title.trim() || !form.body.trim()} />
        </>
      )}
      {stage === 2 && (
        <>
          <StepBar steps={steps} step={2} title={t('কত তাড়াতাড়ি করতে হবে?', 'How soon is it needed?')} hint={t('জরুরি হলে চিহ্নিত করুন। শেষ তারিখ ঐচ্ছিক।', 'Mark it if urgent. The due date is optional.')} />
          <div className="row">
            <button className={`chip${form.priority === 'urgent' ? ' on' : ''}`} style={{ background: form.priority === 'urgent' ? 'var(--urgent)' : undefined }} aria-pressed={form.priority === 'urgent'} onClick={() => setForm({ ...form, priority: form.priority === 'urgent' ? 'normal' : 'urgent' })}>🚨 {t('জরুরি', 'Urgent')}</button>
            <input className="input grow" type="date" min={today()} aria-label={t('শেষ তারিখ', 'Due date')} value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} />
          </div>
          <Err text={error} />
          <StepNav onBack={() => setStage(1)} onNext={submit} busy={busy} label={`${t('পাঠান', 'Send')} →`} />
        </>
      )}
      {stage === 3 && (
        <>
          <StepBar steps={steps} step={3} title={t('পরামর্শ পাঠানো হয়েছে', 'Guidance sent')} />
          <FlowDone icon="✅" title={t(`${who} এটি জমিতে দেখবেন`, `${who} will see this on the land`)} body={t('কাজ শেষ করে তিনি "করেছি" চাপবেন।', 'They press "Done" once the work is finished.')}>
            <button className="btn block" onClick={onDone}>{t('ঠিক আছে', 'OK')}</button>
          </FlowDone>
        </>
      )}
    </Sheet>
  )
}

const VERDICTS: Exclude<Health, 'unknown'>[] = ['healthy', 'watch', 'treat', 'urgent']

/** Look at the scan, decide, correct the message, send. */
export function ReviewSheet({ scan, onClose, onDone }: { scan: Scan; onClose: () => void; onDone: () => void | Promise<void> }) {
  const { t, lang } = useApp()
  const suggested: Exclude<Health, 'unknown'> = ({ none: 'healthy', low: 'watch', medium: 'treat', high: 'urgent' } as const)[scan.ai.severity as 'none'] ?? 'watch'
  const [verdict, setVerdict] = useState<Exclude<Health, 'unknown'>>(suggested)
  const [title, setTitle] = useState(lang === 'bn' ? scan.ai.name_bn : scan.ai.name_en)
  const [body, setBody] = useState((lang === 'bn' ? scan.ai.steps_bn : scan.ai.steps_en).join('\n'))
  const [stage, setStage] = useState(1)
  const { busy, error, run } = useSubmit()
  const steps = [t('দেখুন', 'Check'), t('সিদ্ধান্ত', 'Verdict'), t('বার্তা', 'Message'), t('শেষ', 'Finish')]
  const who = scan.field?.farmer?.name ?? t('কৃষক', 'The farmer')

  const submit = () => run(async () => {
    await api(`/scans/${scan.id}/review`, { body: { verdict, title, body } })
    setStage(4)
  })

  return (
    <Sheet title={t('রিভিউ করুন', 'Review scan')} subtitle={scan.field ? `${scan.field.farmer?.name} · ${scan.field.name}` : undefined} onClose={stage === 4 ? onDone : onClose}>
      {stage === 1 && (
        <>
          <StepBar steps={steps} step={1} title={t('ছবি ও AI-এর ধারণা দেখুন', 'Check the photos and the AI finding')} />
          <ScanCard scan={scan} />
          <StepNav onNext={() => setStage(2)} />
        </>
      )}
      {stage === 2 && (
        <>
          <StepBar steps={steps} step={2} title={t('ফসলের অবস্থা কেমন?', 'What is the crop\'s condition?')} hint={t('AI-এর ধারণা অনুযায়ী আগে থেকে বাছাই করা। প্রয়োজনে বদলান।', 'Pre-selected from the AI finding. Change it if needed.')} />
          <div className="grid-2">
            {VERDICTS.map((v) => (
              <button key={v} aria-pressed={verdict === v} className="btn small" style={{ background: verdict === v ? HEALTH[v].color : `${HEALTH[v].color}22`, color: verdict === v ? '#fff' : HEALTH[v].color }} onClick={() => setVerdict(v)}>{t(HEALTH[v].bn, HEALTH[v].en)}</button>
            ))}
          </div>
          <StepNav onBack={() => setStage(1)} onNext={() => setStage(3)} />
        </>
      )}
      {stage === 3 && (
        <>
          <StepBar steps={steps} step={3} title={t('কৃষকের জন্য বার্তা', 'Message for the farmer')} hint={t('AI-এর খসড়া থেকে শুরু। পাঠানোর আগে সংশোধন করুন।', 'Pre-filled from the AI draft. Correct it before sending.')} />
          <input className="input" maxLength={120} aria-label={t('শিরোনাম', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" rows={5} maxLength={2000} aria-label={t('পরামর্শ', 'Guidance')} value={body} onChange={(e) => setBody(e.target.value)} />
          <Err text={error} />
          <StepNav onBack={() => setStage(2)} onNext={submit} disabled={!title.trim() || !body.trim()} busy={busy} label={`${t('কৃষককে পাঠান', 'Send to farmer')} →`} />
        </>
      )}
      {stage === 4 && (
        <>
          <StepBar steps={steps} step={4} title={t('রিভিউ পাঠানো হয়েছে', 'Review sent')} />
          <FlowDone icon="✅" title={t(`${who} পরামর্শ পেয়েছেন`, `${who} has the guidance`)} body={t('এই স্ক্যান রিভিউ তালিকা থেকে সরে গেছে।', 'This scan has left the review queue.')}>
            <button className="btn block" onClick={onDone}>{t('ঠিক আছে', 'OK')}</button>
          </FlowDone>
        </>
      )}
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
