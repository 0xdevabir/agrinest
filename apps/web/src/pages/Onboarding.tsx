import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, saveSession } from '../api'
import { useI18n } from '../i18n/I18nProvider'

export function Onboarding() {
  const nav = useNavigate()
  const { t, lang, toggleLang } = useI18n()
  const [name, setName] = useState('রহিম')
  const [district, setDistrict] = useState('রংপুর')
  const [area, setArea] = useState('0.8')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function seedDemo() {
    setBusy(true)
    setErr('')
    try {
      const s = await api.seedRahim()
      saveSession(s.farmer_id, s.field_id)
      nav('/')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('onboard.seedFail'))
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const farmer = await api.createFarmer({ name, district })
      const sowing = new Date()
      sowing.setDate(sowing.getDate() - 40)
      const field = await api.createField({
        farmer_id: farmer.id,
        sowing_date: sowing.toISOString().slice(0, 10),
        area_ha: Number(area) || 0.8,
        location_label: district,
        crop: 'rice',
        variety: 'BRRI dhan28',
      })
      saveSession(farmer.id, field.id)
      nav('/')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('onboard.saveFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboard-shell">
      <button
        type="button"
        className="lang-btn onboard-lang"
        onClick={toggleLang}
        aria-label={lang === 'bn' ? t('top.langToEn') : t('top.langToBn')}
      >
        <span className={lang === 'bn' ? 'on' : ''}>বাং</span>
        <span className="lang-sep">/</span>
        <span className={lang === 'en' ? 'on' : ''}>EN</span>
      </button>

      <div className="onboard-card glass-float">
        <p className="brand">
          AgriSathi<span>.</span>
        </p>
        <p className="tagline">{t('onboard.tagline')}</p>

        <div className="hero-band">
          <h1>{t('onboard.title')}</h1>
          <p style={{ margin: '0.4rem 0 0' }}>{t('onboard.sub')}</p>
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">{t('onboard.name')}</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="district">{t('onboard.district')}</label>
            <input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="area">{t('onboard.area')}</label>
            <input id="area" value={area} onChange={(e) => setArea(e.target.value)} inputMode="decimal" />
          </div>
          {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
          <div className="row">
            <button type="submit" disabled={busy}>
              {t('onboard.start')}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={seedDemo}>
              {t('onboard.demo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
