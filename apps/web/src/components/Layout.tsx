import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { api, type Dashboard } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'
import { SCOPES, scopeForPath } from '../nav'
import { metaKeysForPath } from './pageMeta'

const PANEL_KEY = 'agrisathi_panels'

type PanelState = { nav: boolean; info: boolean }
const DEFAULT_PANELS: PanelState = { nav: true, info: true }

function loadPanels(): PanelState {
  try {
    const raw = localStorage.getItem(PANEL_KEY)
    if (!raw) return DEFAULT_PANELS
    const parsed = JSON.parse(raw) as Partial<PanelState>
    return { ...DEFAULT_PANELS, nav: parsed.nav ?? true, info: parsed.info ?? true }
  } catch {
    return DEFAULT_PANELS
  }
}

function PanelToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      {expanded ? <path d="M9.5 4.5v15" /> : <path d="M14.5 4.5v15" />}
    </svg>
  )
}

export function Layout() {
  const location = useLocation()
  const { t, lang, toggleLang, tr } = useI18n()
  const keys = metaKeysForPath(location.pathname)
  const activeScope = scopeForPath(location.pathname)
  const { fieldId } = useSessionField()
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [panels, setPanels] = useState<PanelState>(loadPanels)
  const [mobileInfo, setMobileInfo] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const topToolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fieldId) return
    api.dashboard(fieldId).then(setDash).catch(() => setDash(null))
  }, [fieldId, location.pathname])

  useEffect(() => {
    setMobileInfo(false)
    setNotifOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    localStorage.setItem(PANEL_KEY, JSON.stringify(panels))
  }, [panels])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!topToolsRef.current?.contains(e.target as Node)) {
        setNotifOpen(false)
        if (!query) setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [query])

  function toggle(key: keyof PanelState) {
    setPanels((p) => ({ ...p, [key]: !p[key] }))
  }

  const studioClass = [
    'studio',
    panels.nav ? '' : 'nav-collapsed',
    panels.info ? '' : 'info-collapsed',
    mobileInfo ? 'mobile-info-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const notices = [t('notif.1'), t('notif.2'), t('notif.3')]
  const latestDx = dash?.latest_diagnosis
    ? tr(String(dash.latest_diagnosis.payload.name_bn ?? ''), String(dash.latest_diagnosis.payload.name_en ?? ''))
    : ''

  return (
    <div className={studioClass}>
      <div className="studio-glow" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar-brand">
          <span className="mark">অ</span>
          <div>
            <strong>AgriSathi</strong>
            <small>{t('brand.sub')}</small>
          </div>
        </div>

        <div className="topbar-tools" ref={topToolsRef}>
          <div className={`top-search${searchOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="top-icon-btn"
              aria-label={t('top.search')}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v)
                setNotifOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>
            <input
              ref={searchRef}
              className="top-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('top.searchPh')}
              aria-label={t('top.search')}
            />
          </div>

          <div className="top-notif">
            <button
              type="button"
              className="top-icon-btn"
              aria-label={t('top.notif')}
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v)
                setSearchOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5H4.5S6.5 14.5 6.5 9.5Z" />
                <path d="M10 18.5a2 2 0 0 0 4 0" />
              </svg>
              <span className="top-badge">{notices.length}</span>
            </button>
            {notifOpen && (
              <div className="top-popover" role="dialog" aria-label={t('top.notif')}>
                <p className="top-popover-title">{t('top.notif')}</p>
                <ul>
                  {notices.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            className="lang-btn"
            onClick={toggleLang}
            aria-label={lang === 'bn' ? t('top.langToEn') : t('top.langToBn')}
            title={lang === 'bn' ? 'English' : 'বাংলা'}
          >
            <span className={lang === 'bn' ? 'on' : ''}>বাং</span>
            <span className="lang-sep">/</span>
            <span className={lang === 'en' ? 'on' : ''}>EN</span>
          </button>

          <button
            type="button"
            className="collapse-btn mobile-info-btn"
            aria-label={t('top.pageInfo')}
            aria-expanded={mobileInfo}
            aria-controls="page-info"
            onClick={() => setMobileInfo((v) => !v)}
          >
            <PanelToggleIcon expanded={mobileInfo} />
          </button>
        </div>
      </header>

      <aside
        className={`rail rail-left glass-float${panels.nav ? '' : ' is-rail'}`}
        aria-label={t('nav.main')}
      >
        <div className="rail-toolbar">
          <button
            type="button"
            className="collapse-btn"
            aria-label={panels.nav ? t('nav.collapse') : t('nav.expand')}
            aria-expanded={panels.nav}
            onClick={() => toggle('nav')}
          >
            <PanelToggleIcon expanded={panels.nav} />
          </button>
        </div>

        <nav className="rail-nav">
          <Link to="/" className={`rail-link rail-home${location.pathname === '/' ? ' active' : ''}`}>
            <span className="rail-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
              </svg>
            </span>
            <span className="rail-label">{t('nav.home')}</span>
          </Link>
          {SCOPES.map((scope) => {
            const open = location.pathname === scope.to || location.pathname.startsWith(`${scope.to}/`)
            return (
              <div key={scope.id} className={`scope${open ? ' open' : ''}`}>
                <NavLink
                  to={scope.to}
                  end
                  className={`rail-link scope-head${open ? ' on' : ''}`}
                  title={t(scope.labelKey)}
                >
                  <span className="rail-ico">{scope.icon}</span>
                  <span className="rail-label">{t(scope.labelKey)}</span>
                  <span className="scope-chevron" aria-hidden="true" />
                </NavLink>
                <div className="scope-kids">
                  {scope.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={({ isActive }) => `rail-sub${isActive ? ' active' : ''}`}
                    >
                      {t(child.labelKey)}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="stage">
        <header className="stage-top">
          <div className="stage-copy">
            <p className="stage-kicker">{t(keys.title)}</p>
            <h1 className="stage-title">{t(keys.subtitle)}</h1>
          </div>
          {activeScope && (
            <nav className="scope-subnav" aria-label={t(activeScope.labelKey)}>
              {activeScope.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  className={({ isActive }) => `scope-chip${isActive ? ' active' : ''}`}
                >
                  {t(child.labelKey)}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
        <div className="stage-scroll">
          <Outlet />
        </div>
      </main>

      <aside
        id="page-info"
        className={`rail rail-right glass-float${panels.info ? '' : ' is-rail'}${mobileInfo ? ' open' : ''}`}
        aria-label={t('top.pageInfo')}
      >
        <div className="info-head">
          <h2 className="info-title">{t('info.title')}</h2>
          <button
            type="button"
            className="collapse-btn"
            aria-label={panels.info ? t('info.collapse') : t('info.expand')}
            aria-expanded={panels.info}
            onClick={() => {
              if (window.matchMedia('(max-width: 1100px)').matches) setMobileInfo(false)
              else toggle('info')
            }}
          >
            <PanelToggleIcon expanded={panels.info} />
          </button>
        </div>

        <div className="info-rail-icons" aria-hidden={panels.info}>
          <button type="button" className="rail-icon-btn active" title={t('info.summary')} onClick={() => toggle('info')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10.5V17M12 7.5h.01" />
            </svg>
          </button>
          <button type="button" className="rail-icon-btn" title={t('info.field')} onClick={() => toggle('info')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 18h16M6 18V9l6-4 6 4v9" />
            </svg>
          </button>
          <button type="button" className="rail-icon-btn" title={t('info.tips')} onClick={() => toggle('info')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4h10v14l-5-3-5 3V4Z" />
            </svg>
          </button>
        </div>

        <div className="info-body">
          <div className="info-block">
            <p className="info-label">{t('info.summary')}</p>
            <p>{t(keys.subtitle)}</p>
          </div>

          {dash && (
            <div className="info-block field-chip">
              <p className="info-label">{t('info.field')}</p>
              <strong>{dash.farmer.name}</strong>
              <p>
                {dash.farmer.district} · {dash.field.variety}
              </p>
              <p className="muted">
                {dash.field.area_ha} {t('unit.ha')}
              </p>
            </div>
          )}

          <div className="info-block">
            <p className="info-label">{t('info.tips')}</p>
            <ul className="tip-list">
              {keys.tips.map((tip) => (
                <li key={tip}>{t(tip)}</li>
              ))}
            </ul>
          </div>

          {latestDx && (
            <div className="info-block">
              <p className="info-label">{t('info.latestDx')}</p>
              <p>{latestDx}</p>
            </div>
          )}
        </div>
      </aside>

      {mobileInfo && (
        <button type="button" className="scrim" aria-label={t('info.close')} onClick={() => setMobileInfo(false)} />
      )}

      <nav className="dock glass-float" aria-label={t('nav.mobile')}>
        {SCOPES.map((scope) => {
          const on = location.pathname === scope.to || location.pathname.startsWith(`${scope.to}/`)
          return (
            <NavLink key={scope.id} to={scope.to} className={`dock-link${on ? ' active' : ''}`}>
              <span className="rail-ico">{scope.icon}</span>
              <span>{t(scope.shortKey)}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
