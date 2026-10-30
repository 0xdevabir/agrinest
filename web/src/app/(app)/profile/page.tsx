'use client'

import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui'
import { useApp, useData, type Lang } from '@/lib/app'
import type { Guidance, Localized } from '@/lib/types'

type Farm = {
  level: { level: number; xp: number; next: number; pct: number }
  badges: (Localized & { id: string; emoji: string; earned: boolean })[]
}

const ROLE: Record<string, [string, string]> = {
  farmer: ['কৃষক', 'Farmer'],
  agent: ['মাঠ এজেন্ট', 'Field agent'],
  officer: ['কৃষি কর্মকর্তা', 'Agriculture officer'],
  buyer: ['ক্রেতা', 'Buyer'],
}

export default function ProfilePage() {
  const { t, pick, num, user, lang, setLang, signOut } = useApp()
  const router = useRouter()
  const isFarmer = user?.role === 'farmer'
  const { data } = useData<Farm>(isFarmer ? '/dashboard/farm' : null)
  const { data: feed } = useData<{ guidance: Guidance[] }>(isFarmer ? '/guidance' : null)

  return (
    <div className="page">
      <h1 className="large-title">{user?.name}</h1>
      <p className="sub" style={{ marginBottom: 16 }}>{user && t(...ROLE[user.role])}{user?.organization ? ` · ${user.organization}` : ''}{user?.district ? ` · ${user.district}` : ''}</p>

      {data && (
        <div className="card stack" style={{ background: 'linear-gradient(150deg, #2f3737, #5f7a57)', color: '#fff' }}>
          <div className="row between"><b style={{ fontSize: 26 }}>{t('লেভেল', 'Level')} {num(data.level.level)}</b><span>{num(data.level.xp)} / {num(data.level.next)} XP</span></div>
          <div className="progress" style={{ background: 'rgba(255,255,255,.2)' }}><i style={{ width: `${data.level.pct}%`, background: '#f3e6c8' }} /></div>
        </div>
      )}

      {data && (
        <>
          <h2 className="section-title">{t('অর্জন', 'Achievements')}</h2>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
            {data.badges.map((b) => (
              <div key={b.id} className="card" style={{ textAlign: 'center', padding: 12, opacity: b.earned ? 1 : .45 }}>
                <div style={{ fontSize: 32, filter: b.earned ? undefined : 'grayscale(1)' }} aria-hidden>{b.emoji}</div>
                <div className="small" style={{ fontWeight: 600 }}>{pick(b)}</div>
                <div className="sub" style={{ fontSize: 11 }}>{b.earned ? t('অর্জিত', 'Earned') : t('এখনো বাকি', 'Locked')}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {feed && feed.guidance.length > 0 && (
        <>
          <h2 className="section-title">{t('কর্মকর্তার পরামর্শ', 'Officer guidance')}</h2>
          <div className="group">
            {feed.guidance.slice(0, 10).map((g) => (
              <div className="cell" key={g.id}>
                <span aria-hidden>{g.done_at ? '✅' : g.priority === 'urgent' ? '🚨' : '🧑‍🔬'}</span>
                <span className="grow"><b>{g.title}</b><div className="sub small">{g.field_name} · {g.officer}</div></span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">{t('ভাষা', 'Language')}</h2>
      <Segmented<Lang> value={lang} onChange={setLang} options={[{ id: 'bn', label: 'বাংলা' }, { id: 'en', label: 'English' }]} />

      <button className="btn danger block" style={{ marginTop: 28 }} onClick={async () => { await signOut(); router.replace('/login') }}>{t('বের হন', 'Sign out')}</button>
    </div>
  )
}
