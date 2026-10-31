'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app'
import type { Field } from '@/lib/types'
import type { LandTrip, RouteStep } from './useLandRoute'

// Atlas writes directions in English only, so Bangla readers get the turn from its maneuver code.
const TURN_BN: Record<string, string> = {
  depart: 'যাত্রা শুরু করুন',
  'turn-left': 'বামে ঘুরুন',
  'turn-right': 'ডানে ঘুরুন',
  'slight-left': 'হালকা বামে যান',
  'slight-right': 'হালকা ডানে যান',
  'sharp-left': 'তীক্ষ্ণ বামে ঘুরুন',
  'sharp-right': 'তীক্ষ্ণ ডানে ঘুরুন',
  'uturn-left': 'ইউ-টার্ন নিন',
  'uturn-right': 'ইউ-টার্ন নিন',
  'fork-left': 'বামের পথ ধরুন',
  'fork-right': 'ডানের পথ ধরুন',
  'keep-left': 'বামে থাকুন',
  'keep-right': 'ডানে থাকুন',
  'roundabout-left': 'গোলচত্বর ঘুরে যান',
  'roundabout-right': 'গোলচত্বর ঘুরে যান',
  merge: 'মূল রাস্তায় উঠুন',
  straight: 'সোজা যান',
}

type Props = {
  field: Field
  trip: LandTrip
  located: boolean
  locationFailed: boolean
  onRetryLocation: () => void
  onClose: () => void
}

export function RouteHud({ field, trip, located, locationFailed, onRetryLocation, onClose }: Props) {
  const { t, num, lang } = useApp()
  const [showSteps, setShowSteps] = useState(false)
  const { mode, setMode, routes, choice, setChoice, etas, route, failed, arrived, progress } = trip

  const dist = (m: number) => (m < 1000
    ? `${num(Math.round(m))} ${t('মি', 'm')}`
    : `${num(Math.round(m / 100) / 10)} ${t('কিমি', 'km')}`)
  const time = (s: number) => {
    const mins = Math.max(1, Math.round(s / 60))
    return mins < 60
      ? `${num(mins)} ${t('মিনিট', 'min')}`
      : `${num(Math.floor(mins / 60))} ${t('ঘণ্টা', 'h')} ${num(mins % 60)} ${t('মিনিট', 'min')}`
  }
  const turn = (s: RouteStep) => (lang === 'bn' ? TURN_BN[s.maneuver ?? ''] ?? 'সামনে এগিয়ে যান' : s.instruction)

  const next = route && progress && progress.step >= 0 ? route.steps[progress.step] : null
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}&travelmode=${mode}`

  return (
    <div className="hud-bottom" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)', padding: '0 12px' }}>
      <div className="glass draw-panel" aria-live="polite">
        <div className="row between" style={{ padding: '2px 6px' }}>
          <b className="truncate">🧭 {field.name}</b>
          <button className="close" aria-label={t('পথ দেখানো বন্ধ করুন', 'Stop directions')} onClick={onClose}>✕</button>
        </div>

        <div className="seg">
          <button className={mode === 'driving' ? 'on' : ''} onClick={() => setMode('driving')}>🏍️ {t('গাড়ি / বাইক', 'Vehicle')}{etas.driving !== undefined && <span className="sub small" style={{ display: 'block' }}>{time(etas.driving)}</span>}</button>
          <button className={mode === 'walking' ? 'on' : ''} onClick={() => setMode('walking')}>🚶 {t('হেঁটে', 'Walking')}{etas.walking !== undefined && <span className="sub small" style={{ display: 'block' }}>{time(etas.walking)}</span>}</button>
        </div>

        {arrived ? (
          <div className="small" style={{ padding: '2px 6px', fontWeight: 600 }}>🎉 {t('আপনি জমিতে পৌঁছে গেছেন', 'You have reached your land')}</div>
        ) : !located ? (
          <div className="row between small" style={{ padding: '2px 6px' }}>
            <span>{locationFailed ? t('আপনার অবস্থান পাওয়া যায়নি। ফোনের লোকেশন চালু করুন।', 'Could not find you. Turn on location on your phone.') : t('আপনার অবস্থান খোঁজা হচ্ছে…', 'Finding your location…')}</span>
            {locationFailed && <button className="btn soft small" onClick={onRetryLocation}>{t('আবার চেষ্টা', 'Try again')}</button>}
          </div>
        ) : failed ? (
          <div className="draw-warn small">⚠️ {t('রাস্তার পথ পাওয়া যায়নি। ডটেড রেখাটি জমির সোজা দিক দেখাচ্ছে, এটি রাস্তা নয়।', 'No road route found. The dotted line is the straight direction to the land, not a road.')}</div>
        ) : !route ? (
          <div className="small" style={{ padding: '2px 6px' }}>{t('পথ খোঁজা হচ্ছে…', 'Finding the way…')}</div>
        ) : (
          <>
            {routes.length > 1 && !showSteps && (
              <div className="route-options small">
                {routes.map((r, i) => (
                  <button key={i} className={i === choice ? 'on' : ''} aria-pressed={i === choice} onClick={() => setChoice(i)}>
                    <span className="truncate">{t('পথ', 'Route')} {num(i + 1)}{r.summary && <span className="sub"> · {r.summary}</span>}</span>
                    <span style={{ flex: 'none' }}>{dist(r.distance_m)} · {time(r.duration_s)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="draw-stats">
              <span><b>{dist(progress?.metres_left ?? route.distance_m)}</b></span>
              <span><b>{time(progress?.seconds_left ?? route.duration_s)}</b></span>
            </div>
            {next && <div className="small" style={{ padding: '0 6px', fontWeight: 600 }}>➡️ {turn(next)}{lang === 'bn' && <span className="sub"> · {next.instruction}</span>}</div>}
            {showSteps && (
              <div className="route-steps small">
                {route.steps.map((s, i) => (
                  <div key={i} className={i === progress?.step ? 'on' : ''}>
                    {num(i + 1)}. {turn(s)}{lang === 'bn' && <span className="sub"> · {s.instruction}</span>} <span className="sub">({dist(s.distance_m)})</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="row">
          {route && route.steps.length > 0 && !arrived && <button className="btn soft small grow" style={{ minHeight: 42 }} onClick={() => setShowSteps(!showSteps)}>{showSteps ? t('ধাপ লুকান', 'Hide steps') : t('সব ধাপ', 'All steps')}</button>}
          <a className="btn soft small grow" style={{ minHeight: 42 }} href={mapsUrl} target="_blank" rel="noopener noreferrer">{t('Google Maps-এ খুলুন', 'Open in Google Maps')}</a>
        </div>
      </div>
    </div>
  )
}
