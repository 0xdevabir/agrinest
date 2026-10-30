'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ActivityList, ChainCheck, PerformancePanel, useStamp, type AuditEntry, type Performance } from '@/components/audit'
import { Tile } from '@/components/national'
import { Mark, type MarkName } from '@/components/picture'
import { Segmented, Skeletons, kg } from '@/components/ui'
import { useApp, useData, type Lang } from '@/lib/app'
import type { Guidance, Localized } from '@/lib/types'

type Farm = {
  level: { level: number; xp: number; next: number; pct: number }
  badges: (Localized & { id: string; emoji: string; earned: boolean })[]
  totals: { acres: number; growing: number; expected_kg: number }
  fields: unknown[]
}

const ROLE: Record<string, [string, string]> = {
  farmer: ['কৃষক', 'Farmer'],
  agent: ['মাঠ এজেন্ট', 'Field agent'],
  officer: ['কৃষি কর্মকর্তা', 'Agriculture officer'],
  buyer: ['ক্রেতা', 'Buyer'],
  admin: ['জাতীয় প্রশাসক', 'National admin'],
}

export default function ProfilePage() {
  const { t, num, user, lang, setLang, signOut } = useApp()
  const router = useRouter()
  const isOfficer = user?.role === 'officer'
  const { data: perf, error: perfError } = useData<Performance>(isOfficer ? `/officers/${user.id}/performance` : null)
  const { data: mine } = useData<{ entries: AuditEntry[] }>(user && !isOfficer ? '/audit/me' : null)

  return (
    <div className="page wide">
      <h1 className="large-title">{user?.name}</h1>
      <p className="sub">{user && t(...ROLE[user.role])}{user?.organization ? `, ${user.organization}` : ''}</p>

      <div className="profile">
        <div className="profile-main">
          {user?.role === 'farmer' && <FarmerSummary />}
          {isOfficer && (perfError ? <div className="notice high" role="alert">{perfError}</div> : perf ? <PerformancePanel data={perf} /> : <Skeletons n={3} />)}
          {!isOfficer && (
            <section className="card" style={{ marginTop: user?.role === 'farmer' ? 12 : 0 }}>
              <h2>{t('আমার সাম্প্রতিক কার্যক্রম', 'My recent activity')}</h2>
              {mine ? <ActivityList entries={mine.entries} /> : <Skeletons n={2} />}
            </section>
          )}
        </div>

        <aside className="profile-side">
          <section className="card">
            <h2>{t('অ্যাকাউন্ট', 'Account')}</h2>
            <dl className="facts">
              <dt>{t('ফোন', 'Phone')}</dt><dd>{user && num(user.phone)}</dd>
              {user?.district && <><dt>{t('জেলা', 'District')}</dt><dd>{user.district}</dd></>}
              {user?.upazila && <><dt>{t('উপজেলা', 'Upazila')}</dt><dd>{user.upazila}</dd></>}
              {user?.village && <><dt>{t('গ্রাম', 'Village')}</dt><dd>{user.village}</dd></>}
            </dl>
          </section>
          {user?.role === 'admin' && (
            <section className="card stack">
              <h2 style={{ marginBottom: 0 }}>{t('অডিট রেকর্ড', 'Audit record')}</h2>
              <ChainCheck />
              <Link className="btn small" href="/audit">{t('পুরো রেকর্ড দেখুন', 'Open the full record')}</Link>
            </section>
          )}
          <section className="card">
            <h2>{t('ভাষা', 'Language')}</h2>
            <Segmented<Lang> value={lang} onChange={setLang} options={[{ id: 'bn', label: 'বাংলা' }, { id: 'en', label: 'English' }]} />
          </section>
          <button className="btn danger block" onClick={async () => { await signOut(); router.replace('/login') }}>{t('বের হন', 'Sign out')}</button>
        </aside>
      </div>
    </div>
  )
}

function FarmerSummary() {
  const { t, pick, num } = useApp()
  const stamp = useStamp()
  const { data } = useData<Farm>('/dashboard/farm')
  const { data: feed } = useData<{ guidance: Guidance[] }>('/guidance')
  if (!data) return <Skeletons n={3} />
  return (
    <>
      <div className="tiles" style={{ marginTop: 0 }}>
        <Tile label={t('লেভেল', 'Level')} value={num(data.level.level)} note={`${num(data.level.xp)} / ${num(data.level.next)} XP`} />
        <Tile label={t('জমি', 'Land')} value={`${num(data.totals.acres)} ${t('একর', 'acres')}`} note={`${num(data.fields.length)} ${t('টি জমি', data.fields.length === 1 ? 'plot' : 'plots')}`} />
        <Tile label={t('ফসল চলছে', 'Growing now')} value={num(data.totals.growing)} note={`~${kg(data.totals.expected_kg, num, t)}`} />
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>{t('অর্জন', 'Achievements')}</h2>
        <div className="badges">
          {data.badges.map((b) => (
            <div key={b.id} style={{ textAlign: 'center', opacity: b.earned ? 1 : .45 }}>
              <Mark name={({ landowner: 'pin', watchful: 'search', listener: 'handshake', harvester: 'harvest', trader: 'coins' } as Record<string, MarkName>)[b.id] ?? 'leaf'} frame="badge" dim={!b.earned} />
              <div className="small" style={{ fontWeight: 600 }}>{pick(b)}</div>
              <div className="sub" style={{ fontSize: 11 }}>{b.earned ? t('অর্জিত', 'Earned') : t('এখনো বাকি', 'Locked')}</div>
            </div>
          ))}
        </div>
      </section>

      {feed && feed.guidance.length > 0 && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>{t('কর্মকর্তার পরামর্শ', 'Officer guidance')}</h2>
          <ul className="log">
            {feed.guidance.slice(0, 10).map((g) => (
              <li key={g.id}>
                <span aria-hidden>{g.done_at ? <Mark name="done" frame="chip" /> : g.priority === 'urgent' ? <Mark name="alert" frame="chip" /> : <Mark name="officer" frame="chip" />}</span>
                <span className="grow" style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{g.title}</b><div className="sub small truncate">{g.field_name}, {g.officer}, {stamp(g.created_at)}</div></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
