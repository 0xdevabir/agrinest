import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { buyersFor } from '../market/buyers'
import { PRODUCE, type Category } from '../market/catalog'

type Filter = 'all' | Category

const FILTERS: { id: Filter; key: MessageKey }[] = [
  { id: 'all', key: 'shop.all' },
  { id: 'grain', key: 'shop.grain' },
  { id: 'veg', key: 'shop.veg' },
  { id: 'fruit', key: 'shop.fruit' },
]

export function Shop() {
  const { lang, t } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCE.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!q) return true
      return `${item.name.bn} ${item.name.en} ${item.district.bn} ${item.district.en}`.toLowerCase().includes(q)
    })
  }, [filter, query])

  return (
    <div className="haat">
      <section className="haat-hero">
        <img src="/crops/haat.jpg" alt="" />
        <p>{t('shop.hallLine')}</p>
      </section>

      <div className="haat-tools">
        <input
          className="haat-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('shop.search')}
          aria-label={t('shop.search')}
        />
        <div className="haat-filters" role="tablist">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? 'on' : ''}
              onClick={() => setFilter(item.id)}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && <p className="muted">{t('shop.none')}</p>}

      <div className="produce-grid">
        {items.map((item) => (
          <Link key={item.id} to={`/market/p/${item.id}`} className="produce-card">
            <span className="produce-photo">
              <img src={item.image} alt={item.name[lang]} />
              {item.id === 'rice' && <em>{t('shop.yourStall')}</em>}
            </span>
            <span className="produce-meta">
              <strong>{item.name[lang]}</strong>
              <b>৳{item.price}</b>
              <small>{t('shop.marketRate')}</small>
              <small>{t('shop.buyerCount', { n: buyersFor(item).length })}</small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
