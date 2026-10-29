import type { Lang } from '../i18n/messages'
import type { Bi } from './types'

export function tx(value: Bi | string | null | undefined, lang: Lang) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return lang === 'en' ? value.en : value.bn
}

export function taka(n: number) {
  return `৳${Math.round(n).toLocaleString('en-BD')}`
}
