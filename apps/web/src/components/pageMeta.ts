import type { MessageKey } from '../i18n/messages'

export type PageMetaKeys = {
  title: MessageKey
  subtitle: MessageKey
  tips: MessageKey[]
}

export const PAGE_META: Record<string, PageMetaKeys> = {
  '/': {
    title: 'meta.home.title',
    subtitle: 'meta.home.sub',
    tips: ['meta.home.tip1', 'meta.home.tip2', 'meta.home.tip3'],
  },
  '/guardian': {
    title: 'meta.guardian.title',
    subtitle: 'meta.guardian.sub',
    tips: ['meta.guardian.tip1', 'meta.guardian.tip2', 'meta.guardian.tip3'],
  },
  '/precision': {
    title: 'meta.precision.title',
    subtitle: 'meta.precision.sub',
    tips: ['meta.precision.tip1', 'meta.precision.tip2', 'meta.precision.tip3'],
  },
  '/yield': {
    title: 'meta.yield.title',
    subtitle: 'meta.yield.sub',
    tips: ['meta.yield.tip1', 'meta.yield.tip2', 'meta.yield.tip3'],
  },
  '/market': {
    title: 'meta.market.title',
    subtitle: 'meta.market.sub',
    tips: ['meta.market.tip1', 'meta.market.tip2', 'meta.market.tip3'],
  },
}

export function metaKeysForPath(pathname: string): PageMetaKeys {
  if (pathname.startsWith('/precision')) return PAGE_META['/precision']
  return PAGE_META[pathname] ?? PAGE_META['/']
}
