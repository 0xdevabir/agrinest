'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { Segmented } from '@/components/ui'
import { api } from '@/lib/api'
import { useApp, type User } from '@/lib/app'

const DEMO = [
  { phone: '01700000001', icon: '🧑‍🌾', bn: 'কৃষক', en: 'Farmer' },
  { phone: '01700000002', icon: '🎒', bn: 'এজেন্ট', en: 'Agent' },
  { phone: '01700000003', icon: '🔬', bn: 'কর্মকর্তা', en: 'Officer' },
  { phone: '01700000004', icon: '🏛️', bn: 'ক্রেতা', en: 'Buyer' },
]

export default function LoginPage() {
  const { t, lang, setLang, signIn, user, ready } = useApp()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'farmer' | 'buyer'>('farmer')
  const [form, setForm] = useState({ name: '', phone: '', password: '', district: '', village: '', organization: '', buyer_type: 'broker' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    else enter('/auth/register', { ...form, role, buyer_type: role === 'buyer' ? form.buyer_type : null })
  }

  return (
    <div className="login bg-brand">
      <div className="login-card" style={{ color: '#fff', marginBottom: 'auto', paddingTop: 'calc(env(safe-area-inset-top) + 8vh)' }}>
        <div className="row between">
          <div style={{ fontSize: 52 }} aria-hidden>🌾</div>
          <button className="btn small soft" style={{ color: '#fff', background: 'rgba(255,255,255,.18)' }} onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}>{lang === 'bn' ? 'English' : 'বাংলা'}</button>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1, marginTop: 10 }}>AgriNest</h1>
        <p style={{ fontSize: 18, opacity: .9, marginTop: 6 }}>{t('আপনার জমি, আপনার ফসল, আপনার খেলা।', 'Your land, your crops, your game.')}</p>
      </div>

      <form className="login-card card stack" onSubmit={submit} style={{ marginTop: 24 }}>
        <Segmented value={mode} onChange={(m) => { setMode(m); setError('') }} options={[{ id: 'login', label: t('প্রবেশ', 'Sign in') }, { id: 'register', label: t('নতুন অ্যাকাউন্ট', 'New account') }]} />
        {mode === 'register' && (
          <>
            <Segmented value={role} onChange={setRole} options={[{ id: 'farmer', label: t('আমি কৃষক', "I'm a farmer") }, { id: 'buyer', label: t('আমি ক্রেতা', "I'm a buyer") }]} />
            <input className="input" required placeholder={t('আপনার নাম', 'Your name')} autoComplete="name" value={form.name} onChange={set('name')} />
          </>
        )}
        <input className="input" required inputMode="tel" placeholder={t('মোবাইল নম্বর', 'Mobile number')} autoComplete="tel" value={form.phone} onChange={set('phone')} />
        <input className="input" required type="password" minLength={mode === 'register' ? 6 : undefined} placeholder={t('পাসওয়ার্ড', 'Password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} />
        {mode === 'register' && (
          <>
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
        <button className="btn block" disabled={busy}>{busy ? '…' : mode === 'login' ? t('প্রবেশ করুন', 'Sign in') : t('শুরু করুন', 'Get started')}</button>

        {mode === 'login' && (
          <div>
            <div className="sub small" style={{ textAlign: 'center', marginBottom: 8 }}>{t('ডেমো হিসেবে দেখুন', 'Try a demo account')}</div>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {DEMO.map((d) => (
                <button type="button" key={d.phone} className="btn soft small" style={{ flexDirection: 'column', gap: 0, padding: '8px 2px', minHeight: 62, fontSize: 12 }} disabled={busy} onClick={() => enter('/auth/login', { phone: d.phone, password: 'password' })}>
                  <span style={{ fontSize: 22 }} aria-hidden>{d.icon}</span>{t(d.bn, d.en)}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
