'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/app'
import type { Field } from '@/lib/types'
import { FarmMap, type MapHandle } from './FarmMap'
import { FieldSheet, type FieldIntent } from './FieldSheet'
import { Sheet } from './ui'

export type StageHandle = { open: (id: number, intent?: FieldIntent) => void; fitAll: () => void }

type Props = {
  fields: Field[]
  onChange: () => void | Promise<void>
  children: ReactNode
  showFarmer?: boolean
  drawing?: boolean
  onDrawingChange?: (v: boolean) => void
  drawFarmerId?: number | null
}

/** On-screen estimate only; the server computes the stored area. */
function roughAcres(pts: number[][]) {
  if (pts.length < 3) return 0
  const latRad = (pts[0][1] * Math.PI) / 180
  const mx = 111320 * Math.cos(latRad)
  let sum = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    sum += p[0] * mx * (q[1] * 110540) - q[0] * mx * (p[1] * 110540)
  })
  return Math.abs(sum) / 2 / 4046.86
}

export const MapStage = forwardRef<StageHandle, Props>(function MapStage({ fields, onChange, children, showFarmer, drawing: adding, onDrawingChange, drawFarmerId }, ref) {
  const { t, num, toast } = useApp()
  const map = useRef<MapHandle>(null)
  const [selected, setSelected] = useState<{ id: number; intent?: FieldIntent } | null>(null)
  const [redrawId, setRedrawId] = useState<number | null>(null)
  const drawing = !!adding || redrawId !== null
  const [points, setPoints] = useState<number[][]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([])

  const byId = (id: number) => fields.find((f) => f.id === id)
  useImperativeHandle(ref, () => ({
    open: (id, intent) => {
      const f = byId(id)
      if (f) map.current?.flyTo(f.lng, f.lat)
      setSelected({ id, intent })
    },
    fitAll: () => map.current?.fitAll(),
  }))

  useEffect(() => {
    if (!drawing) { setPoints([]); setResults([]); setQuery('') }
  }, [drawing])

  // Drawing happens against the satellite photo, so zoom close first.
  useEffect(() => {
    if (!drawing) return
    const near = (redrawId !== null && byId(redrawId)) || fields[0]
    if (near) map.current?.flyTo(near.lng, near.lat, 16.5)
    else locate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing])

  const draw = useMemo(() => (drawing ? { points, onAdd: (p: number[]) => setPoints((cur) => [...cur, p]) } : undefined), [drawing, points])

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.current?.flyTo(pos.coords.longitude, pos.coords.latitude, 17),
      () => toast(t('লোকেশন পাওয়া যায়নি, গ্রামের নাম খুঁজুন', 'Location unavailable. Search your village instead.')),
    )
  }

  const search = async () => {
    if (query.trim().length < 2) return
    try {
      const data = await api<{ results: typeof results }>(`/map/search?q=${encodeURIComponent(query.trim())}`)
      setResults(data.results.slice(0, 4))
      if (!data.results.length) toast(t('কিছু পাওয়া যায়নি', 'Nothing found'))
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const data = await api<{ field: Field }>('/fields', { body: { name: name.trim(), points, ...(drawFarmerId ? { farmer_id: drawFarmerId } : {}) } })
      setNaming(false)
      setName('')
      onDrawingChange?.(false)
      await onChange()
      toast(`🎉 ${t('জমি যোগ হয়েছে!', 'Land added!')} +${num(50)} XP`)
      setSelected({ id: data.field.id, intent: 'plant' })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const endRedraw = () => {
    setSelected({ id: redrawId! })
    setRedrawId(null)
  }

  const saveRedraw = async () => {
    setBusy(true)
    try {
      await api(`/fields/${redrawId}`, { method: 'PATCH', body: { points } })
      await onChange()
      toast(`✅ ${t('জমির সীমানা হালনাগাদ হয়েছে', 'Land boundary updated')}`)
      endRedraw()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FarmMap
        ref={map}
        fields={fields}
        selectedId={selected?.id}
        showFarmer={showFarmer}
        draw={draw}
        onSelect={(f) => { map.current?.flyTo(f.lng, f.lat); setSelected({ id: f.id }) }}
      />

      {!drawing && children}

      {drawing && (
        <>
          <div className="hud-top" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <form className="row" onSubmit={(e) => { e.preventDefault(); search() }}>
              <input className="input glass grow" style={{ minHeight: 44, borderRadius: 22 }} placeholder={t('গ্রাম বা এলাকা খুঁজুন', 'Search village or area')} aria-label={t('গ্রাম বা এলাকা খুঁজুন', 'Search village or area')} value={query} onChange={(e) => setQuery(e.target.value)} />
              <button type="button" className="round glass" aria-label={t('আমার অবস্থান', 'My location')} onClick={locate}>📍</button>
            </form>
            {results.length > 0 && (
              <div className="group">
                {results.map((r) => (
                  <button key={r.label} className="cell" onClick={() => { map.current?.flyTo(r.lng, r.lat, 16.5); setResults([]) }}>
                    <span className="grow truncate small">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="draw-hint glass" style={{ top: 'calc(env(safe-area-inset-top) + 124px)' }}>
            {points.length < 3 ? t('জমির প্রতিটি কোনায় ট্যাপ করুন', 'Tap each corner of your land') : `≈ ${num(Math.round(roughAcres(points) * 100) / 100)} ${t('একর', 'acres')}`}
          </div>
          <div className="hud-bottom" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)', padding: '0 12px' }}>
            <div className="glass row" style={{ padding: 8, borderRadius: 20, maxWidth: 480, margin: '0 auto' }}>
              <button className="btn soft small grow" style={{ minHeight: 46 }} onClick={() => (redrawId !== null ? endRedraw() : onDrawingChange?.(false))}>{t('বাতিল', 'Cancel')}</button>
              <button className="btn soft small grow" style={{ minHeight: 46 }} disabled={!points.length} onClick={() => setPoints(points.slice(0, -1))}>↩︎ {t('মুছুন', 'Undo')}</button>
              {redrawId !== null
                ? <button className="btn small grow" style={{ minHeight: 46 }} disabled={busy || points.length < 3} onClick={saveRedraw}>{busy ? '…' : t('সংরক্ষণ', 'Save')}</button>
                : <button className="btn small grow" style={{ minHeight: 46 }} disabled={points.length < 3} onClick={() => setNaming(true)}>{t('পরের ধাপ', 'Next')}</button>}
            </div>
          </div>
        </>
      )}

      {naming && (
        <Sheet title={t('জমির নাম দিন', 'Name this land')} onClose={() => setNaming(false)}>
          <input className="input" autoFocus maxLength={80} placeholder={t('যেমন: পুকুর পাড়ের জমি', 'e.g. Pond-side plot')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn block" disabled={busy || !name.trim()} onClick={save}>{busy ? '…' : t('জমি সংরক্ষণ করুন', 'Save land')}</button>
        </Sheet>
      )}

      {selected && (
        <FieldSheet
          key={selected.id}
          id={selected.id}
          intent={selected.intent}
          preview={byId(selected.id)}
          onClose={() => setSelected(null)}
          onChange={onChange}
          onRedraw={() => { setRedrawId(selected.id); setSelected(null) }}
        />
      )}
    </>
  )
})
