import type { MessageKey } from '../i18n/messages'

export type PageMetaKeys = {
  title: MessageKey
  subtitle: MessageKey
  tips: MessageKey[]
}

const homeTips: MessageKey[] = ['meta.home.tip1', 'meta.home.tip2', 'meta.home.tip3']
const guardianTips: MessageKey[] = ['meta.guardian.tip1', 'meta.guardian.tip2', 'meta.guardian.tip3']
const precisionTips: MessageKey[] = ['meta.precision.tip1', 'meta.precision.tip2', 'meta.precision.tip3']
const yieldTips: MessageKey[] = ['meta.yield.tip1', 'meta.yield.tip2', 'meta.yield.tip3']
const marketTips: MessageKey[] = ['meta.market.tip1', 'meta.market.tip2', 'meta.market.tip3']
const climateTips: MessageKey[] = ['meta.climate.tip1', 'meta.climate.tip2', 'meta.climate.tip3']

export const PAGE_META: Record<string, PageMetaKeys> = {
  '/': { title: 'meta.home.title', subtitle: 'meta.home.sub', tips: homeTips },
  '/guardian': { title: 'meta.guardian.title', subtitle: 'meta.guardian.sub', tips: guardianTips },
  '/guardian/history': {
    title: 'meta.guardian.history.title',
    subtitle: 'meta.guardian.history.sub',
    tips: guardianTips,
  },
  '/guardian/treatment': {
    title: 'meta.guardian.treatment.title',
    subtitle: 'meta.guardian.treatment.sub',
    tips: guardianTips,
  },
  '/precision': { title: 'meta.precision.title', subtitle: 'meta.precision.sub', tips: precisionTips },
  '/precision/irrigation': {
    title: 'meta.precision.irrigation.title',
    subtitle: 'meta.precision.irrigation.sub',
    tips: precisionTips,
  },
  '/precision/fertilizer': {
    title: 'meta.precision.fertilizer.title',
    subtitle: 'meta.precision.fertilizer.sub',
    tips: precisionTips,
  },
  '/precision/stage': {
    title: 'meta.precision.stage.title',
    subtitle: 'meta.precision.stage.sub',
    tips: precisionTips,
  },
  '/climate': { title: 'meta.climate.title', subtitle: 'meta.climate.sub', tips: climateTips },
  '/climate/variety': {
    title: 'meta.climate.variety.title',
    subtitle: 'meta.climate.variety.sub',
    tips: climateTips,
  },
  '/climate/outlook': {
    title: 'meta.climate.outlook.title',
    subtitle: 'meta.climate.outlook.sub',
    tips: climateTips,
  },
  '/yield': { title: 'meta.yield.title', subtitle: 'meta.yield.sub', tips: yieldTips },
  '/yield/drivers': { title: 'meta.yield.drivers.title', subtitle: 'meta.yield.drivers.sub', tips: yieldTips },
  '/yield/baseline': { title: 'meta.yield.baseline.title', subtitle: 'meta.yield.baseline.sub', tips: yieldTips },
  '/market': { title: 'meta.market.title', subtitle: 'meta.market.sub', tips: marketTips },
  '/market/prices': { title: 'meta.market.prices.title', subtitle: 'meta.market.prices.sub', tips: marketTips },
  '/market/p': { title: 'meta.market.product.title', subtitle: 'meta.market.product.sub', tips: marketTips },
  '/market/hint': { title: 'meta.market.hint.title', subtitle: 'meta.market.hint.sub', tips: marketTips },
  '/market/listings': {
    title: 'meta.market.listings.title',
    subtitle: 'meta.market.listings.sub',
    tips: marketTips,
  },
}

export function metaKeysForPath(pathname: string): PageMetaKeys {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  const hit = Object.keys(PAGE_META)
    .filter((k) => k !== '/' && pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0]
  return PAGE_META[hit] ?? PAGE_META['/']
}
