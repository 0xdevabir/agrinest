'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/lib/app'
import { acres, crossingEdges, landIssue, metres, overlaps, perimeter, simplify, type Pt } from '@/lib/landGeo'
import type { Field } from '@/lib/types'
import type { MapDraw } from './FarmMap'

type Shape = { points: Pt[]; closed: boolean }
type History = { past: Shape[]; now: Shape; future: Shape[] }

const EMPTY: Shape = { points: [], closed: false }
const FRESH: History = { past: [], now: EMPTY, future: [] }
const storeKey = (key: string) => `agrinest.land-draft.${key}`
/** A GPS reading worse than this would put the corner in someone else's land. */
const GPS_MAX_ACCURACY_M = 25
const WALK_STEP_M = 4
const WALK_SIMPLIFY_M = 2
const MERGE_M = 1

function readStored(key: string): Shape | null {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey(key)) ?? 'null')
    return s && Array.isArray(s.points) && s.points.length ? { points: s.points, closed: !!s.closed } : null
  } catch { return null }
}

function ringOf(f: Field) { return f.boundary.coordinates[0].slice(0, -1) }

type Options = {
  /** Identifies the land being drawn; null when the drawer is shut. */
  draftKey: string | null
  initial: Pt[] | null
  ghostId: number | null
  fields: Field[]
  onStart: (points: Pt[]) => void
  onFollow: (p: Pt) => void
}

export function useLandDraft({ draftKey, initial, ghostId, fields, onStart, onFollow }: Options) {
  const { t, num, toast } = useApp()
  const [history, setHistory] = useState<History>(FRESH)
  const [selected, setSelected] = useState<number | null>(null)
  const [walk, setWalk] = useState<{ acc: number } | null>(null)
  const [me, setMe] = useState<Pt | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  const { points, closed } = history.now
  // Set while a drag or a walk is running, so all of it undoes as one step.
  const liveStep = useRef(false)
  const baseline = useRef('')
  const watch = useRef<number | null>(null)
  const wake = useRef<{ release: () => Promise<void> } | null>(null)
  const latest = useRef({ onStart, onFollow, initial, toast, t })
  latest.current = { onStart, onFollow, initial, toast, t }

  const commit = useCallback((next: (s: Shape) => Shape) => {
    setHistory((h) => {
      const now = next(h.now)
      return now === h.now ? h : { past: [...h.past, h.now], now, future: [] }
    })
  }, [])

  const live = useCallback((next: (s: Shape) => Shape) => {
    const first = !liveStep.current
    liveStep.current = true
    setHistory((h) => (first ? { past: [...h.past, h.now], now: next(h.now), future: [] } : { ...h, now: next(h.now) }))
  }, [])

  const undo = useCallback(() => {
    setSelected(null)
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h))
  }, [])

  const redo = useCallback(() => {
    setSelected(null)
    setHistory((h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h))
  }, [])

  const removeAt = useCallback((i: number) => {
    setSelected(null)
    commit((s) => {
      const pts = s.points.filter((_, j) => j !== i)
      return { points: pts, closed: s.closed && pts.length >= 3 }
    })
  }, [commit])

  const clear = useCallback(() => {
    setSelected(null)
    commit((s) => (s.points.length ? EMPTY : s))
  }, [commit])

  const close = useCallback(() => {
    setSelected(null)
    commit((s) => (s.points.length >= 3 && !s.closed ? { ...s, closed: true } : s))
  }, [commit])

  const stopWatch = useCallback(() => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current)
    watch.current = null
    wake.current?.release().catch(() => undefined)
    wake.current = null
    setWalk(null)
    setMe(null)
  }, [])

  const startWalk = useCallback(() => {
    const { t, toast } = latest.current
    if (!navigator.geolocation) { toast(t('এই ডিভাইসে জিপিএস নেই', 'This device has no GPS')); return }
    setSelected(null)
    setWalk({ acc: 0 })
    // A sleeping screen stops GPS, so keep it on while walking if the phone allows that.
    navigator.wakeLock?.request('screen').then((w) => { wake.current = w }).catch(() => undefined)
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = [pos.coords.longitude, pos.coords.latitude]
        const acc = Math.round(pos.coords.accuracy)
        setWalk({ acc })
        setMe(p)
        latest.current.onFollow(p)
        if (acc > GPS_MAX_ACCURACY_M) return
        live((s) => {
          const last = s.points[s.points.length - 1]
          return last && metres(last, p) < WALK_STEP_M ? s : { points: [...s.points, p], closed: false }
        })
      },
      () => {
        stopWatch()
        toast(t('জিপিএস পাওয়া যায়নি। লোকেশন চালু করে আবার চেষ্টা করুন', 'Could not get GPS. Turn on location and try again.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    )
  }, [live, stopWatch])

  const stopWalk = useCallback(() => {
    stopWatch()
    setHistory((h) => {
      const pts = simplify(h.now.points, WALK_SIMPLIFY_M)
      return { ...h, now: { points: pts, closed: pts.length >= 3 } }
    })
    liveStep.current = false
  }, [stopWatch])

  const markHere = useCallback(() => {
    const { t, toast } = latest.current
    if (!navigator.geolocation) { toast(t('এই ডিভাইসে জিপিএস নেই', 'This device has no GPS')); return }
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false)
        const acc = Math.round(pos.coords.accuracy)
        if (acc > GPS_MAX_ACCURACY_M) {
          toast(t(`জিপিএস দুর্বল (±${acc} মি)। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন`, `Weak GPS (±${acc} m). Move into the open and try again.`))
          return
        }
        const p = [pos.coords.longitude, pos.coords.latitude]
        commit((s) => ({ ...s, points: [...s.points, p] }))
        latest.current.onFollow(p)
      },
      () => {
        setGpsBusy(false)
        toast(t('জিপিএস পাওয়া যায়নি। লোকেশন চালু করে আবার চেষ্টা করুন', 'Could not get GPS. Turn on location and try again.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }, [commit])

  // Open the drawer on the saved draft, then the existing boundary, then an empty map.
  useEffect(() => {
    setSelected(null)
    liveStep.current = false
    if (!draftKey) { stopWatch(); setHistory(FRESH); baseline.current = ''; return }
    const { initial, onStart, toast, t } = latest.current
    const start: Shape = initial ? { points: initial, closed: true } : EMPTY
    baseline.current = JSON.stringify(start.points)
    const stored = readStored(draftKey)
    const shape = stored ?? start
    setHistory({ past: [], now: shape, future: [] })
    if (stored && JSON.stringify(stored.points) !== baseline.current) toast(t('আগের অসমাপ্ত আঁকা ফিরিয়ে আনা হয়েছে', 'Your unfinished drawing was restored'))
    onStart(shape.points)
  }, [draftKey, stopWatch])

  // A dropped connection or a closed tab must not cost the farmer their work.
  const dirty = !!draftKey && JSON.stringify(points) !== baseline.current
  useEffect(() => {
    if (!draftKey) return
    try {
      if (dirty) localStorage.setItem(storeKey(draftKey), JSON.stringify({ points, closed }))
      else localStorage.removeItem(storeKey(draftKey))
    } catch { /* A full or blocked store only costs the draft. */ }
  }, [draftKey, dirty, points, closed])

  const discard = useCallback(() => {
    if (!draftKey) return
    try { localStorage.removeItem(storeKey(draftKey)) } catch { /* Nothing to clean up. */ }
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, [role="dialog"]')) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && key === 'y') { e.preventDefault(); redo() }
      else if ((key === 'delete' || key === 'backspace') && selected !== null) { e.preventDefault(); removeAt(selected) }
      else if (key === 'enter') close()
      else if (key === 'escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draftKey, selected, undo, redo, removeAt, close])

  const others = useMemo(() => fields.filter((f) => f.id !== ghostId), [fields, ghostId])
  const snapRings = useMemo(() => others.map(ringOf), [others])
  const crossing = useMemo(() => crossingEdges(points), [points])
  const issue = useMemo(() => landIssue(points), [points])
  const overlapping = useMemo(() => others.filter((f) => overlaps(points, ringOf(f))), [others, points])
  const area = useMemo(() => acres(points), [points])
  const length = useMemo(() => perimeter(points, closed), [points, closed])

  const distance = useCallback((m: number) => (m >= 1000
    ? `${num(Math.round(m / 10) / 100)} ${t('কিমি', 'km')}`
    : `${num(Math.round(m))} ${t('মি', 'm')}`), [num, t])

  const mapDraw = useMemo<MapDraw | undefined>(() => (draftKey ? {
    points,
    closed,
    selected,
    crossing,
    me,
    walking: !!walk,
    ghostId,
    snapRings,
    edgeLabel: distance,
    onAdd: (p) => commit((s) => ({ ...s, points: [...s.points, p] })),
    onClose: close,
    onPick: setSelected,
    onDrag: (i, p) => live((s) => ({ ...s, points: s.points.map((q, j) => (j === i ? p : q)) })),
    onInsert: (edge, p) => live((s) => ({ ...s, points: [...s.points.slice(0, edge + 1), p, ...s.points.slice(edge + 1)] })),
    onDragEnd: () => {
      liveStep.current = false
      // A corner dropped on its neighbour is meant to go away.
      setHistory((h) => {
        const pts = h.now.points.filter((p, i, all) => metres(p, all[(i + 1) % all.length]) >= MERGE_M)
        return pts.length === h.now.points.length || pts.length < 3 ? h : { ...h, now: { ...h.now, points: pts } }
      })
      setSelected(null)
    },
  } : undefined), [draftKey, points, closed, selected, crossing, me, walk, ghostId, snapRings, distance, commit, close, live])

  return {
    points, closed, selected, area, length, crossing, issue, overlapping, walk, gpsBusy, dirty, mapDraw, distance,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo, redo, clear, close, removeAt, startWalk, stopWalk, markHere, discard,
  }
}

export type LandDraft = ReturnType<typeof useLandDraft>
