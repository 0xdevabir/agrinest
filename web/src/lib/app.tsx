'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'

export type Lang = 'bn' | 'en'
export type Role = 'farmer' | 'agent' | 'officer' | 'buyer' | 'admin'
export type User = { id: number; name: string; phone: string; role: Role; buyer_type?: string; organization?: string; district?: string; upazila?: string; village?: string; xp: number }

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (bn: string, en: string) => string
  pick: (o: { bn?: string; en?: string } | null | undefined) => string
  num: (v: number | string) => string
  user: User | null
  ready: boolean
  signIn: (token: string, user: User) => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  toast: (message: string) => void
}

const AppContext = createContext<Ctx | null>(null)

/** Last answer per endpoint, so returning to a page shows it at once while it refreshes. */
const cache = new Map<string, unknown>()
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('bn')
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refreshUser = useCallback(async () => {
    const data = await api<{ user: User }>('/auth/me')
    setUser(data.user)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agrinest.lang')
      if (saved === 'en' || saved === 'bn') setLangState(saved)
    } catch { /* default language */ }
    if (!getToken()) { setReady(true); return }
    refreshUser().catch(() => undefined).finally(() => setReady(true))
  }, [refreshUser])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => {
      setLangState(l)
      try { localStorage.setItem('agrinest.lang', l) } catch { /* not persisted */ }
    },
    t: (bn, en) => (lang === 'bn' ? bn : en),
    pick: (o) => (o ? (lang === 'bn' ? o.bn ?? o.en : o.en ?? o.bn) ?? '' : ''),
    num: (v) => {
      const text = typeof v === 'number' ? v.toLocaleString('en-IN') : v
      return lang === 'bn' ? text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : text
    },
    user,
    ready,
    signIn: (token, u) => { cache.clear(); setToken(token); setUser(u) },
    signOut: async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
      setToken(null)
      cache.clear()
      setUser(null)
    },
    refreshUser,
    toast: (m) => {
      setMessage(m)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(null), 2800)
    },
  }), [lang, user, ready, refreshUser])

  return (
    <AppContext.Provider value={value}>
      {children}
      {message && <div className="toast glass" role="status">{message}</div>}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

/** Loads a GET endpoint; `reload` refetches without blanking what is on screen. */
export function useData<T>(path: string | null) {
  const [result, setResult] = useState<{ path: string | null; data: T | null; error: string | null } | null>(null)
  const wanted = useRef(path)
  wanted.current = path
  const reload = useCallback(async () => {
    if (!path) return
    try {
      const data = await api<T>(path)
      cache.set(path, data)
      // A slow answer for a page already left must not replace the current one.
      if (wanted.current === path) setResult({ path, data, error: null })
    } catch (e) {
      if (wanted.current === path) setResult({ path, data: (cache.get(path) as T) ?? null, error: (e as Error).message })
    }
  }, [path])
  useEffect(() => { reload() }, [reload])
  const fresh = result?.path === path ? result : null
  return { data: fresh ? fresh.data : path ? (cache.get(path) as T) ?? null : null, error: fresh?.error ?? null, reload }
}
