'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/app'
import type { Field } from '@/lib/types'
import { FarmMap, type MapHandle } from './FarmMap'
import { FieldSheet, type FieldIntent } from './FieldSheet'
import { PlantSheet } from './actions'
import { LandDrawHud } from './LandDrawHud'
import { FlowDone, Sheet, StepBar, StepNav } from './ui'
import { useLandDraft } from './useLandDraft'

export type StageHandle = { open: (id: number, intent?: FieldIntent) => void; fitAll: () => void }

type Props = {
  fields: Field[]
  onChange: () => void | Promise<void>
  children: ReactNode
  showFarmer?: boolean
  drawing?: boolean
  onDrawingChange?: (v: boolean) => void
  /** The agent draws for a farmer they chose in an earlier step. */
  drawFarmer?: { id: number; name: string; village?: string | null } | null
  /** Leaves the draw step for the step before it. Without one, the flow is cancelled. */
  onDrawBack?: () => void
}

export function addLandSteps(t: (bn: string, en: string) => string, forFarmer: boolean) {
  return [...(forFarmer ? [t('কৃষক', 'Farmer')] : []), t('আঁকুন', 'Draw'), t('নাম', 'Name'), t('ফসল', 'Crop')]
}

export const MapStage = forwardRef<StageHandle, Props>(function MapStage({ fields, onChange, children, showFarmer, drawing: adding, onDrawingChange, drawFarmer, onDrawBack }, ref) {
  const { t, num, toast, user } = useApp()
  const map = useRef<MapHandle>(null)
  const [selected, setSelected] = useState<{ id: number; intent?: FieldIntent } | null>(null)
  const [redrawId, setRedrawId] = useState<number | null>(null)
  const drawing = !!adding || redrawId !== null
  const steps = addLandSteps(t, !!drawFarmer)
  const lead = drawFarmer ? 1 : 0
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([])
  // The land just saved, while its flow finishes: first the crop, then what to do next.
  const [added, setAdded] = useState<{ field: Field; planted?: boolean; ended?: boolean } | null>(null)

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
    if (!drawing) { setResults([]); setQuery('') }
    else if (drawFarmer?.village) setQuery(drawFarmer.village)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing])

  const redrawing = redrawId !== null ? byId(redrawId) : undefined
  const initial = useMemo(() => redrawing?.boundary.coordinates[0].slice(0, -1) ?? null, [redrawing])
  const draft = useLandDraft({
    draftKey: drawing ? `${user?.id ?? 'me'}.${redrawId !== null ? `land-${redrawId}` : `new-${drawFarmer?.id ?? 'own'}`}` : null,
    initial,
    ghostId: redrawId,
    fields,
    // Drawing happens against the satellite photo, so zoom close first.
    onStart: (start) => {
      if (start.length) { map.current?.fitPoints(start); return }
      const near = fields.find((f) => f.farmer?.id === drawFarmer?.id) || fields[0]
      if (near) map.current?.flyTo(near.lng, near.lat, 16.5, 0)
      else locate()
    },
    onFollow: (p) => map.current?.follow(p),
  })
  const { points } = draft

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.current?.flyTo(pos.coords.longitude, pos.coords.latitude, 17, 0),
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
      const data = await api<{ field: Field }>('/fields', { body: { name: name.trim(), points, ...(drawFarmer ? { farmer_id: drawFarmer.id } : {}) } })
      setNaming(false)
      setName('')
      draft.discard()
      onDrawingChange?.(false)
      await onChange()
      toast(`🎉 ${t('জমি সংরক্ষণ হয়েছে', 'Land saved')} +${num(50)} XP`)
      setAdded({ field: data.field })
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
      draft.discard()
      await onChange()
      toast(`✅ ${t('জমির সীমানা হালনাগাদ হয়েছে', 'Land boundary updated')}`)
      endRedraw()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    if (redrawId === null && onDrawBack) {
      // Going back keeps the draft, so returning to this farmer picks it up again.
      onDrawBack()
      return
    }
    if (draft.dirty && !window.confirm(t('আঁকা জমি বাতিল করবেন?', 'Discard this drawing?'))) return
    draft.discard()
    if (redrawId !== null) endRedraw()
    else onDrawingChange?.(false)
  }

  return (
    <>
      <FarmMap
        ref={map}
        fields={fields}
        selectedId={selected?.id}
        showFarmer={showFarmer}
        draw={draft.mapDraw}
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
                  <button key={r.label} className="cell" onClick={() => { map.current?.flyTo(r.lng, r.lat, 16.5, 0); setResults([]) }}>
                    <span className="grow truncate small">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <LandDrawHud
            draft={draft}
            step={redrawId !== null ? null : { steps, at: 1 + lead }}
            title={drawFarmer ? t(`${drawFarmer.name}-এর জমি আঁকুন`, `Draw ${drawFarmer.name}'s land`) : t('জমি আঁকুন', 'Draw the land')}
            hideHint={results.length > 0}
            busy={busy}
            cancelLabel={redrawId === null && onDrawBack ? `← ${t('পেছনে', 'Back')}` : t('বাতিল', 'Cancel')}
            doneLabel={redrawId !== null ? t('সংরক্ষণ', 'Save') : t('পরের ধাপ', 'Next')}
            canFinish={points.length >= 3 && !draft.issue && (redrawId === null || draft.dirty)}
            onDone={() => { draft.close(); if (redrawId !== null) saveRedraw(); else setNaming(true) }}
            onCancel={cancel}
            onFit={() => map.current?.fitPoints(points)}
          />
        </>
      )}

      {naming && (
        <Sheet title={t('জমির নাম দিন', 'Name this land')} onClose={() => setNaming(false)}>
          <StepBar steps={steps} step={2 + lead} title={t('জমির একটি নাম দিন', 'Give the land a name')} hint={t('যে নামে সহজে চেনা যায়। এরপর ফসলের তথ্য দেবেন।', 'One that is easy to recognise. You will add the crop next.')} />
          <input className="input" autoFocus maxLength={80} placeholder={t('যেমন: পুকুর পাড়ের জমি', 'e.g. Pond-side plot')} value={name} onChange={(e) => setName(e.target.value)} />
          <StepNav onBack={() => setNaming(false)} onNext={save} disabled={!name.trim()} busy={busy} label={`${t('সংরক্ষণ করে পরের ধাপ', 'Save and continue')} →`} />
        </Sheet>
      )}

      {added && !added.ended && (
        <PlantSheet
          field={added.field}
          flow={{ steps, step: 3 + lead }}
          onClose={() => setAdded({ ...added, ended: true })}
          onDone={async () => { await onChange(); setAdded({ ...added, planted: true, ended: true }) }}
        />
      )}

      {added?.ended && (
        <Sheet title={t('জমি যোগ হয়েছে', 'Land added')} subtitle={added.field.name} onClose={() => setAdded(null)}>
          <FlowDone
            icon={added.planted ? '🌱' : '✅'}
            title={added.planted ? t('জমি ও ফসল প্রস্তুত!', 'Land and crop are set!') : t('জমি সংরক্ষণ হয়েছে', 'The land is saved')}
            body={added.planted
              ? t('এখন ফসলের ছবি পাঠান, যাতে ফসলের অবস্থা দেখা যায়।', 'Now send crop photos so its health can be checked.')
              : t('ফসল লাগালে এই জমিতে ট্যাপ করে তথ্য দিন।', 'When a crop is planted, tap this land on the map to add it.')}
          >
            {added.planted
              ? <button className="btn block" onClick={() => { setSelected({ id: added.field.id, intent: 'scan' }); setAdded(null) }}>📸 {t('ছবি পাঠান', 'Send photos')}</button>
              : <button className="btn block" onClick={() => { setSelected({ id: added.field.id }); setAdded(null) }}>{t('জমিটি দেখুন', 'Open this land')}</button>}
            <button className="btn soft block" onClick={() => { setAdded(null); onDrawingChange?.(true) }}>➕ {drawFarmer ? t(`${drawFarmer.name}-এর আরেকটি জমি`, `Another land for ${drawFarmer.name}`) : t('আরেকটি জমি যোগ করুন', 'Add another land')}</button>
            <button className="btn soft block" onClick={() => setAdded(null)}>{t('এখন শেষ', 'Done for now')}</button>
          </FlowDone>
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
