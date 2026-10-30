'use client'

import type { ReactNode } from 'react'
import type { MessageKey } from './i18n/messages'

export type NavChild = {
  to: string
  labelKey: MessageKey
  end?: boolean
}

export type NavScope = {
  id: string
  to: string
  labelKey: MessageKey
  shortKey: MessageKey
  icon: ReactNode
  children: NavChild[]
}

const leaf = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 19c8-1 12-6 14-14-8 1-13 6-14 14Z" />
    <path d="M9 15c2-2 4-4 7-6" />
  </svg>
)

export const SCOPES: NavScope[] = [
  {
    id: 'precision',
    to: '/precision',
    labelKey: 'nav.precision',
    shortKey: 'nav.precision.short',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
      </svg>
    ),
    children: [
      { to: '/precision', labelKey: 'nav.precision.advice', end: true },
      { to: '/precision/irrigation', labelKey: 'nav.precision.irrigation' },
      { to: '/precision/fertilizer', labelKey: 'nav.precision.fertilizer' },
      { to: '/precision/stage', labelKey: 'nav.precision.stage' },
    ],
  },
  {
    id: 'guardian',
    to: '/guardian',
    labelKey: 'nav.guardian',
    shortKey: 'nav.guardian.short',
    icon: leaf,
    children: [
      { to: '/guardian', labelKey: 'nav.guardian.scan', end: true },
      { to: '/guardian/history', labelKey: 'nav.guardian.history' },
      { to: '/guardian/treatment', labelKey: 'nav.guardian.treatment' },
    ],
  },
  {
    id: 'market',
    to: '/market',
    labelKey: 'nav.market',
    shortKey: 'nav.market.short',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h16l-1.2 9.2A2 2 0 0 1 16.8 20H7.2a2 2 0 0 1-2-1.8L4 9Z" />
        <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      </svg>
    ),
    children: [
      { to: '/market', labelKey: 'nav.market.shop', end: true },
      { to: '/market/prices', labelKey: 'nav.market.prices' },
      { to: '/market/hint', labelKey: 'nav.market.hint' },
      { to: '/market/listings', labelKey: 'nav.market.listings' },
    ],
  },
  {
    id: 'yield',
    to: '/yield',
    labelKey: 'nav.yield',
    shortKey: 'nav.yield.short',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16M7 19V10l5-4 5 4v9" />
      </svg>
    ),
    children: [
      { to: '/yield', labelKey: 'nav.yield.estimate', end: true },
      { to: '/yield/drivers', labelKey: 'nav.yield.drivers' },
      { to: '/yield/baseline', labelKey: 'nav.yield.baseline' },
    ],
  },
  {
    id: 'climate',
    to: '/climate',
    labelKey: 'nav.climate',
    shortKey: 'nav.climate.short',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 16a4 4 0 0 1 .2-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 1 1 17 16H7Z" />
      </svg>
    ),
    children: [
      { to: '/climate', labelKey: 'nav.climate.alerts', end: true },
      { to: '/climate/variety', labelKey: 'nav.climate.variety' },
      { to: '/climate/outlook', labelKey: 'nav.climate.outlook' },
    ],
  },
]

export function scopeForPath(pathname: string): NavScope | undefined {
  return SCOPES.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`))
}
