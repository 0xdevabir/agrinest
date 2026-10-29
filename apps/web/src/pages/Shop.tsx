import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import { clearBasket, readBasket, setLineKg, type BasketLine } from '../market/basket'
import { PRODUCE, produceById, type Category } from '../market/catalog'

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
  const [lines, setLines] = useState<BasketLine[]>(() => readBasket())
  const [open, setOpen] = useState(false)
  const [ordered, setOrdered] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCE.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!q) return true
      return `${item.name.bn} ${item.name.en} ${item.district.bn} ${item.district.en}`.toLowerCase().includes(q)
    })
  }, [filter, query])

  const detailed = lines
    .map((line) => {
      const item = produceById(line.id)
      return item ? { line, item } : null
    })
    .filter((row): row is { line: BasketLine; item: (typeof PRODUCE)[number] } => row !== null)

  const count = detailed.reduce((sum, row) => sum + row.line.kg, 0)
  const total = detailed.reduce((sum, row) => sum + row.line.kg * row.item.price, 0)

  function order() {
    setLines(clearBasket())
    setOrdered(true)
  }

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
              <small>
                {item.seller[lang]}, {item.district[lang]}
              </small>
            </span>
          </Link>
        ))}
      </div>

      <button type="button" className="basket-fab" onClick={() => setOpen(true)}>
        {t('shop.basket')}
        <span>{count.toFixed(1)} {t('shop.kg')}</span>
      </button>

      {open && (
        <div className="basket-layer" role="presentation" onClick={() => setOpen(false)}>
          <aside
            className="basket-sheet"
            role="dialog"
            aria-label={t('shop.basket')}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>{t('shop.basket')}</h2>
              <button type="button" className="text-btn" onClick={() => setOpen(false)}>
                {t('shop.close')}
              </button>
            </header>
            {ordered && <p className="stall-note">{t('shop.ordered')}</p>}
            {!detailed.length && <p className="muted">{t('shop.empty')}</p>}
            <ul>
              {detailed.map(({ line, item }) => (
                <li key={line.id}>
                  <img src={item.image} alt="" />
                  <div>
                    <strong>{item.name[lang]}</strong>
                    <small>
                      ৳{item.price} · {line.kg} {t('shop.kg')}
                    </small>
                  </div>
                  <button type="button" className="text-btn" onClick={() => setLines(setLineKg(line.id, 0))}>
                    {t('shop.remove')}
                  </button>
                </li>
              ))}
            </ul>
            {detailed.length > 0 && (
              <footer>
                <p>
                  {t('shop.total')} <strong>৳{Math.round(total)}</strong>
                </p>
                <button type="button" onClick={order}>
                  {t('shop.order')}
                </button>
              </footer>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

