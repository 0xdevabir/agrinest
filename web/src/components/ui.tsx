'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'
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

export function HealthPill({ status }: { status: Health }) {
  const { t } = useApp()
  const h = HEALTH[status]
  return <span className="pill" style={{ color: h.color, background: `${h.color}22` }}><i className="dot" />{t(h.bn, h.en)}</span>
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => <button key={o.id} role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

const TABS: Record<Role, { href: string; icon: string; bn: string; en: string }[]> = {
  farmer: [
    { href: '/', icon: '🗺️', bn: 'আমার খামার', en: 'My Farm' },
    { href: '/market', icon: '🛒', bn: 'বাজার', en: 'Market' },
    { href: '/profile', icon: '🏅', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  agent: [
    { href: '/', icon: '🗺️', bn: 'ভিজিট', en: 'Visits' },
    { href: '/farmers', icon: '👥', bn: 'কৃষক', en: 'Farmers' },
    { href: '/profile', icon: '👤', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  officer: [
    { href: '/', icon: '🗺️', bn: 'এলাকা', en: 'Area' },
    { href: '/reviews', icon: '🔬', bn: 'রিভিউ', en: 'Reviews' },
    { href: '/profile', icon: '👤', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  admin: [
    { href: '/', icon: '📊', bn: 'সারা দেশ', en: 'Nationwide' },
    { href: '/officers', icon: '🏛️', bn: 'কর্মকর্তা', en: 'Officers' },
    { href: '/profile', icon: '👤', bn: 'প্রোফাইল', en: 'Profile' },
  ],
  buyer: [
    { href: '/market', icon: '🛒', bn: 'বাজার', en: 'Market' },
    { href: '/profile', icon: '👤', bn: 'প্রোফাইল', en: 'Profile' },
  ],
}

export function TabBar() {
  const { user, t } = useApp()
  const path = usePathname()
  if (!user) return null
  return (
    <nav className="tabbar glass" aria-label="Main">
      <div className="side-brand"><span aria-hidden>🌾</span><b>AgriNest</b></div>
      {TABS[user.role].map((tab) => (
        <Link key={tab.href} href={tab.href} className={path === tab.href ? 'on' : ''}>
          <b aria-hidden>{tab.icon}</b>{t(tab.bn, tab.en)}
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
