'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { metres } from '@/lib/landGeo'
import type { Field } from '@/lib/types'
import type { MyLocation } from './useMyLocation'

export type RouteMode = 'driving' | 'walking'
export type RouteStep = { instruction: string; maneuver: string | null; distance_m: number; at: number[] }
export type LandRoute = { summary: string | null; distance_m: number; duration_s: number; path: number[][]; steps: RouteStep[]; alternatives?: LandRoute[] }
export type LandTrip = ReturnType<typeof useLandRoute>

const OFF_ROUTE_M = 80
const REFETCH_GAP_MS = 30000
const ARRIVED_M = 60

/** Metres from a point to a line segment, flat-earth: these are short distances. */
function toSegment(p: number[], a: number[], b: number[]) {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180)
  const ky = 110540
  const [ax, ay, bx, by] = [(a[0] - p[0]) * kx, (a[1] - p[1]) * ky, (b[0] - p[0]) * kx, (b[1] - p[1]) * ky]
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1
  const k = Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / len2))
  return Math.hypot(ax + k * (bx - ax), ay + k * (by - ay))
}

function nearestIndex(path: number[][], p: number[]) {
  let best = 0
  let bestM = Infinity
  path.forEach((q, i) => {
    const d = metres(q, p)
    if (d < bestM) { best = i; bestM = d }
  })
  return best
}

function askRoute(me: MyLocation, target: Field, mode: RouteMode) {
  return api<{ route: LandRoute }>('/map/route', {
    body: { from: { lat: me.p[1], lng: me.p[0] }, to: { lat: target.lat, lng: target.lng }, mode },
  })
}

/** Directions from the user's live position to a land, re-routed when they leave the path. */
export function useLandRoute(target: Field | null, me: MyLocation | null) {
  const [mode, setMode] = useState<RouteMode>('driving')
  const [routes, setRoutes] = useState<LandRoute[]>([])
  const [choice, setChoice] = useState(0)
  const [etas, setEtas] = useState<Partial<Record<RouteMode, number>>>({})
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const askedAt = useRef(0)
  const located = !!me
  const route = routes[choice] ?? null

  const load = async () => {
    if (!target || !me) return
    const ticket = ++seq.current
    askedAt.current = Date.now()
    try {
      const data = await askRoute(me, target, mode)
      if (ticket !== seq.current) return
      setRoutes([data.route, ...(data.route.alternatives ?? [])])
      setChoice(0)
      setEtas((e) => ({ ...e, [mode]: data.route.duration_s }))
      setFailed(false)
    } catch {
      if (ticket !== seq.current) return
      setRoutes([])
      setFailed(true)
    }
  }

  useEffect(() => {
    seq.current++
    setRoutes([])
    setChoice(0)
    setFailed(false)
    if (target && located) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, mode, located])

  // The other mode's time, so walking and driving can be compared before switching.
  useEffect(() => {
    setEtas({})
    if (!target || !me) return
    const other: RouteMode = mode === 'driving' ? 'walking' : 'driving'
    let live = true
    askRoute(me, target, other)
      .then((data) => { if (live) setEtas((e) => ({ ...e, [other]: data.route.duration_s })) })
      .catch(() => undefined)
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, located])

  const arrived = !!(target && me && metres(me.p, [target.lng, target.lat]) < ARRIVED_M)

  // Try again after a failure, or when the user has clearly left the route.
  useEffect(() => {
    if (!target || !me || arrived || Date.now() - askedAt.current < REFETCH_GAP_MS) return
    const off = route && route.path.every((q, i) => i === 0 || toSegment(me.p, route.path[i - 1], q) > Math.max(OFF_ROUTE_M, me.acc ?? 0))
    if (failed || off) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  const stepAt = useMemo(() => route?.steps.map((s) => nearestIndex(route.path, s.at)) ?? [], [route])

  const progress = useMemo(() => {
    if (!route || !me) return null
    const at = nearestIndex(route.path, me.p)
    let left = 0
    for (let i = at + 1; i < route.path.length; i++) left += metres(route.path[i - 1], route.path[i])
    const whole = stepAt.length ? stepAt.findIndex((i) => i > at) : -1
    return { metres_left: left, seconds_left: route.duration_s * (left / (route.distance_m || 1)), step: whole }
  }, [route, stepAt, me])

  return { mode, setMode, routes, choice, setChoice, etas, route, failed, arrived, progress }
}
