'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app'
import type { Field } from '@/lib/types'
import { Mark } from './picture'
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

const TURN_ANGLE: Record<string, number> = {
  'turn-left': -90,
  'turn-right': 90,
  'slight-left': -45,
  'slight-right': 45,
  'sharp-left': -135,
  'sharp-right': 135,
  'uturn-left': 180,
  'uturn-right': 180,
  'fork-left': -30,
  'fork-right': 30,
  'keep-left': -20,
  'keep-right': 20,
  'roundabout-left': -90,
  'roundabout-right': 90,
}

function TurnArrow({ maneuver }: { maneuver: string | null }) {
  return (
    <svg className="turn-arrow" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${TURN_ANGLE[maneuver ?? ''] ?? 0}deg)` }}>
      <path d="M12 20V5M6 11l6-6 6 6" />
    </svg>
  )
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

  return (
    <div className="hud-bottom" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)', padding: '0 12px' }}>
      <div className="glass draw-panel route-panel" aria-live="polite">
        <div className="row between route-head">
          <span className="row truncate" style={{ gap: 6 }}><Mark name="pin" frame="inline" /><b className="truncate">{field.name}</b></span>
          <button className="close" aria-label={t('পথ দেখানো বন্ধ করুন', 'Stop directions')} onClick={onClose}>✕</button>
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
            {next && progress && (
              <div className="route-turn">
                <TurnArrow maneuver={next.maneuver} />
                <div className="grow">
                  <div className="route-turn-in">{lang === 'bn' ? `${dist(progress.metres_to_turn)} পরে` : `In ${dist(progress.metres_to_turn)}`}</div>
                  <div className="route-turn-what">{turn(next)}</div>
                  {lang === 'bn' && <div className="route-turn-road truncate">{next.instruction}</div>}
                </div>
              </div>
            )}
            <div className="row between route-sum">
              <div className="grow">
                <b>{time(progress?.seconds_left ?? route.duration_s)}</b>
                <span className="sub"> · {dist(progress?.metres_left ?? route.distance_m)}</span>
              </div>
              {route.steps.length > 0 && <button className="route-steps-toggle" aria-expanded={showSteps} onClick={() => setShowSteps(!showSteps)}>{showSteps ? t('ধাপ লুকান', 'Hide steps') : t('সব ধাপ', 'All steps')}</button>}
            </div>
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
            {showSteps && (
              <div className="route-steps small">
                {route.steps.map((s, i) => (
                  <div key={i} className={i === progress?.step ? 'on' : ''}>
                    <TurnArrow maneuver={s.maneuver} />
                    <span className="grow">{turn(s)}{lang === 'bn' && <span className="sub"> · {s.instruction}</span>}</span>
                    <span className="sub" style={{ flex: 'none' }}>{dist(s.distance_m)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="seg route-modes">
          <button className={mode === 'driving' ? 'on' : ''} onClick={() => setMode('driving')}>{t('গাড়ি / বাইক', 'Vehicle')}{etas.driving !== undefined && <span className="sub small" style={{ display: 'block' }}>{time(etas.driving)}</span>}</button>
          <button className={mode === 'walking' ? 'on' : ''} onClick={() => setMode('walking')}>{t('হেঁটে', 'Walking')}{etas.walking !== undefined && <span className="sub small" style={{ display: 'block' }}>{time(etas.walking)}</span>}</button>
        </div>
      </div>
    </div>
  )
}
