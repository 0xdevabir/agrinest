'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { TabGlyph, type TabIcon } from '@/components/tab-icons'
import { useApp, type Role } from '@/lib/app'
import { HEALTH, type Health } from '@/lib/types'

export function Sheet({ title, subtitle, onClose, children, overMap }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; overMap?: boolean }) {
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  return (
    <>
      <div className={`scrim${overMap ? ' map-scrim' : ''}`} onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
        <div
          className="sheet-head"
          onPointerDown={(e) => { start.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)) }}
          onPointerUp={() => { if (drag > 90) onClose(); setDrag(0); start.current = null }}
        >
          <div className="grabber" />
          <div className="row between">
            <div className="grow">
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }} className="truncate">{title}</h2>
              {subtitle && <div className="sub truncate">{subtitle}</div>}
            </div>
            <button className="close" aria-label="Close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  )
}

/** Shows every step of a flow by name, where the user is, and what to do right now. */
export function StepBar({ steps, step, title, hint }: { steps: string[]; step: number; title: ReactNode; hint?: ReactNode }) {
  const { num } = useApp()
  return (
    <div className="stepbar">
      <ol>
        {steps.map((label, i) => (
          <li key={label} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''} aria-current={i + 1 === step ? 'step' : undefined}>
            <i aria-hidden>{i + 1 < step ? '✓' : num(i + 1)}</i>{label}
          </li>
        ))}
      </ol>
      <b>{title}</b>
      {hint && <div className="sub small">{hint}</div>}
    </div>
  )
}

/** Back and forward controls for one step of a flow. The first step has nowhere to go back to. */
export function StepNav({ onBack, onNext, label, disabled, busy }: { onBack?: () => void; onNext: () => void; label?: ReactNode; disabled?: boolean; busy?: boolean }) {
  const { t } = useApp()
  return (
    <div className="row">
      {onBack && <button type="button" className="btn soft" disabled={busy} onClick={onBack}>← {t('পেছনে', 'Back')}</button>}
      <button type="button" className="btn grow" disabled={disabled || busy} onClick={onNext}>{busy ? '…' : label ?? `${t('পরের ধাপ', 'Next')} →`}</button>
    </div>
  )
}

/** Ends a flow: says what just happened and offers the next thing to do. */
export function FlowDone({ icon, title, body, children }: { icon: string; title: ReactNode; body?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="flow-done">
        <div aria-hidden>{icon}</div>
        <h3>{title}</h3>
        {body && <p className="sub">{body}</p>}
      </div>
      {children}
    </>
  )
}

export function HealthPill({ status }: { status: Health }) {
  const { t } = useApp()
  const h = HEALTH[status]
  return <span className="pill" style={{ color: h.color, background: `${h.color}22` }}><i className="dot" />{t(h.bn, h.en)}</span>
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => <button key={o.id} type="button" role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

const TABS: Record<Role, { href: string; icon: TabIcon; bn: string; en: string }[]> = {
  farmer: [
    { href: '/', icon: 'field', bn: 'আমার খামার', en: 'My Farm' },
    { href: '/market', icon: 'market', bn: 'বাজার', en: 'Market' },
    { href: '/profile', icon: 'medal', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  agent: [
    { href: '/', icon: 'pin', bn: 'ভিজিট', en: 'Visits' },
    { href: '/farmers', icon: 'people', bn: 'কৃষক', en: 'Farmers' },
    { href: '/profile', icon: 'person', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  officer: [
    { href: '/', icon: 'map', bn: 'এলাকা', en: 'Area' },
    { href: '/reviews', icon: 'review', bn: 'রিভিউ', en: 'Reviews' },
    { href: '/profile', icon: 'person', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  admin: [
    { href: '/', icon: 'chart', bn: 'সারা দেশ', en: 'Nationwide' },
    { href: '/officers', icon: 'badge', bn: 'কর্মকর্তা', en: 'Officers' },
    { href: '/audit', icon: 'shield', bn: 'অডিট', en: 'Audit' },
    { href: '/profile', icon: 'person', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  buyer: [
    { href: '/market', icon: 'market', bn: 'বাজার', en: 'Market' },
    { href: '/profile', icon: 'person', bn: 'প্রোফাইল', en: 'Profile' },
  ],
}

export function TabBar() {
  const { user, t } = useApp()
  const path = usePathname()
  // The tab answers the tap straight away; the page follows when it has loaded.
  const [tapped, setTapped] = useState<string | null>(null)
  useEffect(() => setTapped(null), [path])
  if (!user) return null
  const tabs = TABS[user.role]
  const current = tabs.find((tab) => (tab.href === '/' ? path === '/' : path === tab.href || path.startsWith(`${tab.href}/`)))?.href
  const active = tapped ?? current
  const index = tabs.findIndex((tab) => tab.href === active)
  return (
    <nav className={`tabbar glass${index < 0 ? ' none' : ''}`} aria-label="Main" style={{ '--n': tabs.length, '--i': Math.max(index, 0) } as CSSProperties}>
      <div className="side-brand"><span aria-hidden>🌾</span><b>AgriNest</b></div>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.href === active ? 'on' : ''}
          aria-current={tab.href === current ? 'page' : undefined}
          onClick={(e) => { if (tab.href !== current && !e.metaKey && !e.ctrlKey && !e.shiftKey) setTapped(tab.href) }}
        >
          <span className="tab-ico"><TabGlyph name={tab.icon} /></span>{t(tab.bn, tab.en)}
        </Link>
      ))}
    </nav>
  )
}

export function Skeletons({ n = 3 }: { n?: number }) {
  return <div className="stack">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: 84 }} />)}</div>
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return <div className="empty"><b aria-hidden>{icon}</b>{children}</div>
}

export function kg(value: number, num: (v: number | string) => string, t: (bn: string, en: string) => string) {
  return value >= 1000
    ? `${num(Math.round(value / 100) / 10)} ${t('টন', 't')}`
    : `${num(Math.round(value))} ${t('কেজি', 'kg')}`
}

export function dateLabel(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' })
}
