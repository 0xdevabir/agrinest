'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { FieldBackdrop } from '@/components/FieldBackdrop'
import { CropPicture, Mark, type MarkName } from '@/components/picture'
import { Segmented, StepBar } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, type User } from '@/lib/app'

const DEMO: { phone: string; mark: MarkName; bn: string; en: string }[] = [
  { phone: '01700000001', mark: 'farmer', bn: 'কৃষক', en: 'Farmer' },
  { phone: '01700000002', mark: 'agent', bn: 'এজেন্ট', en: 'Agent' },
  { phone: '01700000003', mark: 'officer', bn: 'কর্মকর্তা', en: 'Officer' },
  { phone: '01700000004', mark: 'buyer', bn: 'ক্রেতা', en: 'Buyer' },
  { phone: '01700000007', mark: 'admin', bn: 'প্রশাসক', en: 'Admin' },
]

export default function LoginPage() {
  const { t, lang, setLang, signIn, user, ready } = useApp()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'farmer' | 'buyer'>('farmer')
  const [form, setForm] = useState({ name: '', phone: '', password: '', district: '', village: '', organization: '', buyer_type: 'broker' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(1)
  const steps = [t('ধরন', 'Type'), t('তথ্য', 'Details'), t('এলাকা', 'Area')]

  useEffect(() => { if (ready && user) router.replace('/') }, [ready, user, router])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const enter = async (path: string, body: unknown) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ token: string; user: User }>(path, { body })
      signIn(data.token, data.user)
      router.replace('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') enter('/auth/login', { phone: form.phone, password: form.password })
    else if (step < 3) setStep(step + 1)
    else enter('/auth/register', { ...form, role, buyer_type: role === 'buyer' ? form.buyer_type : null })
  }

  return (
    <div className="login">
      <FieldBackdrop />
      <div className="login-card" style={{ color: '#fff', marginBottom: 'auto', paddingTop: 'calc(env(safe-area-inset-top) + 8vh)' }}>
        <div className="row between">
          <div aria-hidden><CropPicture crop="rice" frame="hero" alt="" /></div>
          <button className="btn small soft" style={{ color: '#fff', background: 'rgba(255,255,255,.18)' }} onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1, marginTop: 10 }}>AgriNest</h1>
        <p style={{ fontSize: 18, opacity: .9, marginTop: 6 }}>{t('আপনার জমি, আপনার ফসল, আপনার খেলা।', 'Your land, your crops, your game.')}</p>
      </div>

      <form className="login-card card stack" onSubmit={submit} style={{ marginTop: 24 }}>
        <Segmented value={mode} onChange={(m) => { setMode(m); setStep(1); setError('') }} options={[{ id: 'login', label: t('প্রবেশ', 'Sign in') }, { id: 'register', label: t('নতুন অ্যাকাউন্ট', 'New account') }]} />
        {mode === 'login' && (
          <>
            <input className="input" required inputMode="tel" placeholder={t('মোবাইল নম্বর', 'Mobile number')} autoComplete="tel" value={form.phone} onChange={set('phone')} />
            <input className="input" required type="password" placeholder={t('পাসওয়ার্ড', 'Password')} autoComplete="current-password" value={form.password} onChange={set('password')} />
          </>
        )}
        {mode === 'register' && step === 1 && (
          <>
            <StepBar steps={steps} step={1} title={t('আপনি কে?', 'Who are you?')} hint={t('আপনার অ্যাকাউন্ট কী কাজে লাগবে তা বেছে নিন', 'Choose what you will use the account for')} />
            <Segmented value={role} onChange={setRole} options={[{ id: 'farmer', label: t('আমি কৃষক', "I'm a farmer") }, { id: 'buyer', label: t('আমি ক্রেতা', "I'm a buyer") }]} />
          </>
        )}
        {mode === 'register' && step === 2 && (
          <>
            <StepBar steps={steps} step={2} title={t('আপনার তথ্য দিন', 'Enter your details')} hint={t('মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে পরে প্রবেশ করবেন', 'You will sign in with this mobile number and password')} />
            <input className="input" required placeholder={t('আপনার নাম', 'Your name')} autoComplete="name" value={form.name} onChange={set('name')} />
            <input className="input" required inputMode="tel" placeholder={t('মোবাইল নম্বর', 'Mobile number')} autoComplete="tel" value={form.phone} onChange={set('phone')} />
            <input className="input" required type="password" minLength={6} placeholder={t('পাসওয়ার্ড', 'Password')} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </>
        )}
        {mode === 'register' && step === 3 && (
          <>
            <StepBar steps={steps} step={3} title={role === 'farmer' ? t('আপনার এলাকা', 'Your area') : t('আপনার ব্যবসা', 'Your business')} hint={role === 'farmer' ? t('এরপর মানচিত্রে আপনার প্রথম জমি আঁকবেন', 'Next you will draw your first land on the map') : t('এরপর বাজারে ফসলের দর দেখবেন', 'Next you will see crop prices in the market')} />
            <input className="input" required placeholder={t('জেলা', 'District')} value={form.district} onChange={set('district')} />
            {role === 'farmer' && <input className="input" placeholder={t('গ্রাম', 'Village')} value={form.village} onChange={set('village')} />}
            {role === 'buyer' && (
              <>
                <select className="input" aria-label={t('ক্রেতার ধরন', 'Buyer type')} value={form.buyer_type} onChange={set('buyer_type')}>
                  <option value="broker">{t('ব্যবসায়ী / ব্রোকার', 'Broker')}</option>
                  <option value="government">{t('সরকারি সংস্থা', 'Government')}</option>
                  <option value="company">{t('কোম্পানি', 'Company')}</option>
                </select>
                <input className="input" placeholder={t('প্রতিষ্ঠানের নাম', 'Organization')} value={form.organization} onChange={set('organization')} />
              </>
            )}
          </>
        )}
        {error && <div className="notice high" role="alert">{error}</div>}
        <div className="row">
          {mode === 'register' && step > 1 && <button type="button" className="btn soft" disabled={busy} onClick={() => { setStep(step - 1); setError('') }}>← {t('পেছনে', 'Back')}</button>}
          <button className="btn grow" disabled={busy}>{busy ? '…' : mode === 'login' ? t('প্রবেশ করুন', 'Sign in') : step < 3 ? `${t('পরের ধাপ', 'Next')} →` : t('শুরু করুন', 'Get started')}</button>
        </div>

        {mode === 'login' && (
          <div>
            <div className="sub small" style={{ textAlign: 'center', marginBottom: 8 }}>{t('ডেমো হিসেবে দেখুন', 'Try a demo account')}</div>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {DEMO.map((d) => (
                <button type="button" key={d.phone} className="btn soft small" style={{ flexDirection: 'column', gap: 0, padding: '8px 2px', minHeight: 62, fontSize: 12 }} disabled={busy} onClick={() => enter('/auth/login', { phone: d.phone, password: 'password' })}>
                  <Mark name={d.mark} frame="demo" />{t(d.bn, d.en)}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
