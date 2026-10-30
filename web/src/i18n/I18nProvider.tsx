'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { climateEn, phraseEn, stageEn, treatmentEn } from './contentEn'
import { messages, type Lang, type MessageKey } from './messages'

const LANG_KEY = 'agrisathi_lang'

type Vars = Record<string, string | number>

type I18nValue = {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: MessageKey, vars?: Vars) => string
  tr: (bn: string | null | undefined, enFallback?: string) => string
  climate: (riskId: string, titleBn: string, actionBn: string) => { title: string; action: string }
  disease: (
    id: string,
    nameBn: string,
    nameEn: string,
    stepsBn: string[],
    noteBn: string,
  ) => { name: string; steps: string[]; note: string }
  stageLabel: (stage: string, stageBn: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function fill(template: string, vars?: Vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bn'
  } catch {
    return 'bn'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('bn')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setLangState(loadLang())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(LANG_KEY, lang)
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
  }, [lang, ready])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'bn' ? 'en' : 'bn')), [])

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => fill(messages[lang][key] ?? messages.bn[key] ?? key, vars),
    [lang],
  )

  const tr = useCallback(
    (bn: string | null | undefined, enFallback?: string) => {
      if (!bn) return enFallback ?? ''
      if (lang === 'bn') return bn
      if (phraseEn[bn]) return phraseEn[bn]
      // Dynamic seeded advice / market lines
      let m = bn.match(
        /সেচ এড়িয়ে চলুন—আগামী ৪৮ ঘণ্টায় প্রায় (\d+(?:\.\d+)?) মিমি বৃষ্টির সম্ভাবনা\.?\s*বৃষ্টির পর সার দিন—আজ নয়\.?/u,
      )
      if (m) {
        return `Skip irrigation — about ${m[1]} mm rain likely in the next 48 hours. Fertilize after rain — not today.`
      }
      m = bn.match(/আজকের দাম \((\d+) টাকা\) একটু কম—২–৩ দিন অপেক্ষা করলে ভালো হতে পারে/u)
      if (m) {
        return `Today’s price (BDT ${m[1]}) is a bit low — waiting 2–3 days may be better`
      }
      m = bn.match(/পরামর্শকৃত জাত:\s*(.+)/u)
      if (m) return `Suggested variety: ${m[1]}`
      return enFallback ?? bn
    },
    [lang],
  )

  const climate = useCallback(
    (riskId: string, titleBn: string, actionBn: string) => {
      if (lang === 'bn') return { title: titleBn, action: actionBn }
      const hit = climateEn[riskId]
      return {
        title: hit?.title ?? phraseEn[titleBn] ?? titleBn,
        action: hit?.action ?? phraseEn[actionBn] ?? actionBn,
      }
    },
    [lang],
  )

  const disease = useCallback(
    (id: string, nameBn: string, nameEn: string, stepsBn: string[], noteBn: string) => {
      if (lang === 'bn') return { name: nameBn, steps: stepsBn, note: noteBn }
      const hit = treatmentEn[id]
      return {
        name: hit?.name ?? nameEn ?? nameBn,
        steps: hit?.steps ?? stepsBn,
        note: hit?.chemical_note ?? noteBn,
      }
    },
    [lang],
  )

  const stageLabel = useCallback(
    (stage: string, stageBn: string) => {
      if (lang === 'bn') return stageBn
      return stageEn[stage] ?? stageEn[stageBn] ?? stageBn
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, tr, climate, disease, stageLabel }),
    [lang, setLang, toggleLang, t, tr, climate, disease, stageLabel],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}


