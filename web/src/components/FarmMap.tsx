'use client'

import maplibregl, { type LngLatBoundsLike, type Map as MapLibre, type MapMouseEvent, type MapTouchEvent, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getToken } from '@/lib/api'
import { useApp } from '@/lib/app'
import { metres } from '@/lib/landGeo'
import { cropSrc } from '@/components/picture'
import { HEALTH, type Field } from '@/lib/types'
import type { MyLocation } from './useMyLocation'

export type MapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number, pitch?: number) => void
  fitAll: () => void
  fitPoints: (points: number[][]) => void
  follow: (p: number[]) => void
  center: () => [number, number]
}

type Props = {
  fields: Field[]
  selectedId?: number | null
  onSelect?: (f: Field) => void
  /** In draw mode, the map edits this boundary instead of selecting land. */
  draw?: MapDraw
  showFarmer?: boolean
  base?: MapBase
  me?: MyLocation | null
  route?: RouteLine | null
}

export type MapBase = 'satellite' | 'map'
/** `walkIn` is the last stretch off the road, or the straight line when no road route exists. */
export type RouteLine = { path: number[][]; walkIn: number[][] | null }

export type MapDraw = {
  points: number[][]
  closed: boolean
  selected: number | null
  crossing: Set<number>
  me: number[] | null
  walking: boolean
  /** The land being redrawn, hidden so its old outline does not get in the way. */
  ghostId: number | null
  snapRings: number[][][]
  edgeLabel: (metres: number) => string
  onAdd: (p: number[]) => void
  onClose: () => void
  onPick: (index: number | null) => void
  onDrag: (index: number, p: number[]) => void
  onInsert: (edge: number, p: number[]) => void
  onDragEnd: () => void
}

const BD_CENTER: [number, number] = [90.4, 23.9]
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection
// Fingers are less exact than a mouse, so they get a bigger target and the corner rides above them.
const HIT_PX = { mouse: { vertex: 14, mid: 11 }, touch: { vertex: 26, mid: 20 } }
const TOUCH_LIFT_PX = 46
const DRAG_START_PX = 4
const SNAP_PX = { corner: 14, edge: 9 }
const LABEL_MIN_PX = 70

function boundsOf(fields: Field[]): LngLatBoundsLike | null {
  const pts = fields.flatMap((f) => f.boundary.coordinates[0])
  if (!pts.length) return null
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

const tileUrl = (style: string, lang?: string) => `${window.location.origin}/api/map/tiles/${style}/{z}/{x}/{y}${lang ? `?lang=${lang}` : ''}`

/** The GPS error margin as a ring on the ground. */
function accuracyRing([lng, lat]: number[], radius: number): GeoJSON.Polygon {
  const dLat = radius / 110540
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring = Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * 2 * Math.PI
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]
  })
  return { type: 'Polygon', coordinates: [ring] }
}

export const FarmMap = forwardRef<MapHandle, Props>(function FarmMap({ fields, selectedId, onSelect, draw, showFarmer, base = 'satellite', me, route }, ref) {
  const { pick, lang } = useApp()
  const labelLang = useRef(lang)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const markers = useRef<Marker[]>([])
  const edgeTags = useRef<Marker[]>([])
  const paintDraft = useRef<(cursor?: number[] | null) => void>(() => undefined)
  const drawOn = !!draw
  const ghostId = draw?.ghostId ?? null
  const [loaded, setLoaded] = useState(false)
  const flown = useRef(false)
  const latest = useRef({ fields, onSelect, draw })
  latest.current = { fields, onSelect, draw }

  const padding = () => {
    const wide = window.innerWidth >= 900
    // On a desk, keep land clear of the officer's list as well as the side sheet.
    const rail = wide && document.querySelector('.land-rail')
    return { top: 110, bottom: wide ? 110 : 210, left: rail ? 420 : 50, right: wide ? 460 : 50 }
  }

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom = 16.5, pitch = 50) => map.current?.flyTo({ center: [lng, lat], zoom, pitch, speed: 1.2, padding: padding(), essential: true }),
    fitAll: () => {
      const b = boundsOf(latest.current.fields)
      if (b) map.current?.fitBounds(b, { padding: padding(), maxZoom: 17.5, pitch: 45, duration: 1200 })
    },
    fitPoints: (points) => {
      if (!points.length) return
      const lngs = points.map((p) => p[0])
      const lats = points.map((p) => p[1])
      // Measured against the drawing hint and the panel, not the side sheet, which is shut here.
      map.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 200, bottom: 250, left: 50, right: 70 }, maxZoom: 18.5, pitch: 0, duration: 800, essential: true })
    },
    follow: (p) => map.current?.easeTo({ center: p as [number, number], zoom: Math.max(map.current.getZoom(), 17.5), pitch: 0, duration: 600 }),
    center: () => {
      const c = map.current?.getCenter()
      return c ? [c.lng, c.lat] : BD_CENTER
    },
  }))

  useEffect(() => {
    if (!box.current) return
    const m = new maplibregl.Map({
      container: box.current,
      center: BD_CENTER,
      zoom: 6.2,
      pitch: 0,
      maxPitch: 65,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [tileUrl('satellite')],
            tileSize: 256,
            maxzoom: 20,
            attribution: 'Atlas · Map data ©Google',
          },
          // Road, village and place names over the photo, or the same on a drawn map.
          labels: { type: 'raster', tiles: [tileUrl('labels', lang)], tileSize: 256, maxzoom: 20, attribution: 'Atlas · Map data ©Google' },
          light: { type: 'raster', tiles: [tileUrl('light', lang)], tileSize: 256, maxzoom: 20, attribution: 'Atlas · Map data ©Google' },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: base === 'satellite' ? 'visible' : 'none' } },
          { id: 'labels', type: 'raster', source: 'labels', layout: { visibility: base === 'satellite' ? 'visible' : 'none' } },
          { id: 'light', type: 'raster', source: 'light', layout: { visibility: base === 'map' ? 'visible' : 'none' } },
        ],
      },
      // Tiles sit behind the signed-in API, which holds the Atlas key server-side.
      transformRequest: (url) => (url.includes('/api/map/')
        ? { url, headers: { Authorization: `Bearer ${getToken()}` } }
        : { url }),
    })
    m.addControl(new maplibregl.AttributionControl({ compact: true }))
    m.dragRotate.enable()

    m.on('load', () => {
      m.addSource('fields', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'field-fill', type: 'fill', source: 'fields', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'selected'], 0.5, 0.28] } })
      m.addLayer({ id: 'field-line-glow', type: 'line', source: 'fields', paint: { 'line-color': ['get', 'color'], 'line-width': 9, 'line-opacity': 0.3, 'line-blur': 5 } })
      m.addLayer({ id: 'field-line', type: 'line', source: 'fields', paint: { 'line-color': ['case', ['get', 'selected'], '#ffffff', ['get', 'color']], 'line-width': ['case', ['get', 'selected'], 3.5, 2.2] } })

      m.addSource('route', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } })
      m.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2f7bf6', 'line-width': 5.5 } })
      m.addLayer({ id: 'route-walk', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'walk'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#2f7bf6', 'line-width': 4, 'line-dasharray': [0.5, 2] } })

      m.addSource('me', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'me-accuracy', type: 'fill', source: 'me', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2f7bf6', 'fill-opacity': 0.16 } })
      m.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#2f7bf6', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })

      m.addSource('draft', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': ['case', ['get', 'bad'], '#e5484d', '#96eefb'], 'fill-opacity': 0.28 } })
      m.addLayer({ id: 'draft-casing', type: 'line', source: 'draft', filter: ['==', ['get', 'kind'], 'edge'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#10201a', 'line-width': 6, 'line-opacity': 0.45 } })
      m.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['==', ['get', 'kind'], 'edge'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['get', 'bad'], '#ff5a5f', '#ffffff'], 'line-width': 3 } })
      m.addLayer({ id: 'draft-guide', type: 'line', source: 'draft', filter: ['==', ['get', 'kind'], 'guide'], paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } })
      m.addLayer({ id: 'draft-mid', type: 'circle', source: 'draft', filter: ['==', ['get', 'kind'], 'mid'], paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-opacity': 0.8, 'circle-stroke-color': '#10201a', 'circle-stroke-width': 1 } })
      m.addLayer({ id: 'draft-me', type: 'circle', source: 'draft', filter: ['==', ['get', 'kind'], 'me'], paint: { 'circle-radius': 8, 'circle-color': '#2f7bf6', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
      m.addLayer({ id: 'draft-vertex', type: 'circle', source: 'draft', filter: ['==', ['get', 'kind'], 'vertex'], paint: { 'circle-radius': ['case', ['get', 'selected'], 11, ['get', 'first'], 10, 8], 'circle-color': ['case', ['get', 'selected'], '#f5b700', ['get', 'first'], '#7cdc8a', '#ffffff'], 'circle-stroke-color': '#10201a', 'circle-stroke-width': 2.5 } })
      m.addLayer({ id: 'draft-snap', type: 'circle', source: 'draft', filter: ['==', ['get', 'kind'], 'snap'], paint: { 'circle-radius': 13, 'circle-opacity': 0, 'circle-stroke-color': '#f5b700', 'circle-stroke-width': 3 } })

      m.on('click', 'field-fill', (e) => {
        if (latest.current.draw) return
        const id = e.features?.[0]?.properties?.id
        const f = latest.current.fields.find((x) => x.id === id)
        if (f) latest.current.onSelect?.(f)
      })
      m.on('mouseenter', 'field-fill', () => { if (!latest.current.draw) m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'field-fill', () => { if (!latest.current.draw) m.getCanvas().style.cursor = '' })
      setLoaded(true)
    })

    const midpoint = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const edgesOf = (d: MapDraw) => {
      const n = d.points.length
      return Array.from({ length: d.closed ? n : Math.max(0, n - 1) }, (_, i) => [d.points[i], d.points[(i + 1) % n]])
    }
    let snapMark: number[] | null = null

    paintDraft.current = (cursor) => {
      const d = latest.current.draw
      const source = m.getSource('draft') as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const features: GeoJSON.Feature[] = []
      const add = (geometry: GeoJSON.Geometry, properties: Record<string, unknown>) => features.push({ type: 'Feature', geometry, properties })
      const pts = d?.points ?? []
      const n = pts.length
      if (d) {
        if (n >= 3) add({ type: 'Polygon', coordinates: [[...pts, pts[0]]] }, { bad: d.crossing.size > 0 })
        edgesOf(d).forEach((e, i) => add({ type: 'LineString', coordinates: e }, { kind: 'edge', bad: d.crossing.has(i) }))
        if (!d.closed && n >= 3) add({ type: 'LineString', coordinates: [pts[n - 1], pts[0]] }, { kind: 'guide' })
        if (!d.closed && n >= 1 && cursor) add({ type: 'LineString', coordinates: [pts[n - 1], cursor] }, { kind: 'guide' })
        if (!d.walking) edgesOf(d).forEach((e) => add({ type: 'Point', coordinates: midpoint(e[0], e[1]) }, { kind: 'mid' }))
        pts.forEach((p, i) => add({ type: 'Point', coordinates: p }, { kind: 'vertex', first: i === 0 && !d.closed, selected: i === d.selected }))
        if (d.me) add({ type: 'Point', coordinates: d.me }, { kind: 'me' })
        if (snapMark) add({ type: 'Point', coordinates: snapMark }, { kind: 'snap' })
      }
      source.setData({ type: 'FeatureCollection', features })

      // Side lengths are DOM markers: this style carries no glyphs for map text.
      const edges = d ? edgesOf(d) : []
      while (edgeTags.current.length > edges.length) edgeTags.current.pop()!.remove()
      edges.forEach((e, i) => {
        let tag = edgeTags.current[i]
        if (!tag) {
          const el = document.createElement('div')
          el.className = 'edge-tag'
          // Lifted off the edge so the handle at its midpoint stays visible.
          tag = new maplibregl.Marker({ element: el, offset: [0, -18] }).setLngLat(e[0] as [number, number]).addTo(m)
          edgeTags.current[i] = tag
        }
        tag.setLngLat(midpoint(e[0], e[1]) as [number, number])
        const el = tag.getElement()
        el.textContent = d!.edgeLabel(metres(e[0], e[1]))
        el.style.display = m.project(e[0] as [number, number]).dist(m.project(e[1] as [number, number])) < LABEL_MIN_PX ? 'none' : ''
      })
    }
    m.on('zoom', () => { if (latest.current.draw) paintDraft.current() })

    /** Neighbouring plots share boundaries, so a corner pulls onto nearby land: its corners first, then its edges. */
    const snap = (at: maplibregl.Point): { p: number[]; snapped: boolean } => {
      const free = m.unproject(at)
      const rings = latest.current.draw?.snapRings ?? []
      let best: number[] | null = null
      let bestPx: number = SNAP_PX.corner
      for (const ring of rings) for (const q of ring) {
        const dist = m.project(q as [number, number]).dist(at)
        if (dist < bestPx) { best = q; bestPx = dist }
      }
      if (!best) {
        bestPx = SNAP_PX.edge
        for (const ring of rings) ring.forEach((q, i) => {
          const a = m.project(q as [number, number])
          const next = ring[(i + 1) % ring.length]
          const b = m.project(next as [number, number])
          const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1
          const k = Math.max(0, Math.min(1, ((at.x - a.x) * (b.x - a.x) + (at.y - a.y) * (b.y - a.y)) / len2))
          const dist = Math.hypot(at.x - a.x - k * (b.x - a.x), at.y - a.y - k * (b.y - a.y))
          if (dist < bestPx) { best = [q[0] + k * (next[0] - q[0]), q[1] + k * (next[1] - q[1])]; bestPx = dist }
        })
      }
      return best ? { p: best, snapped: true } : { p: [free.lng, free.lat], snapped: false }
    }

    type Hit = { kind: 'vertex' | 'mid'; index: number }
    const hitTest = (at: maplibregl.Point, touch: boolean): Hit | null => {
      const d = latest.current.draw
      if (!d || d.walking) return null
      const reach = touch ? HIT_PX.touch : HIT_PX.mouse
      let found: Hit | null = null
      let bestPx: number = reach.vertex
      d.points.forEach((p, index) => {
        const dist = m.project(p as [number, number]).dist(at)
        if (dist < bestPx) { found = { kind: 'vertex', index }; bestPx = dist }
      })
      if (found) return found
      bestPx = reach.mid
      edgesOf(d).forEach((e, index) => {
        const dist = m.project(midpoint(e[0], e[1]) as [number, number]).dist(at)
        if (dist < bestPx) { found = { kind: 'mid', index }; bestPx = dist }
      })
      return found
    }

    let grip: (Hit & { from: maplibregl.Point; touch: boolean; moved: boolean }) | null = null
    let lastGripEnd = 0

    const onDown = (e: MapMouseEvent | MapTouchEvent) => {
      const touch = e.type === 'touchstart'
      if (touch && (e as MapTouchEvent).points.length > 1) return
      const hit = hitTest(e.point, touch)
      if (!hit) return
      // Holding a corner must not also pan the map.
      e.preventDefault()
      m.dragPan.disable()
      grip = { ...hit, from: e.point, touch, moved: false }
    }
    const onMove = (e: MapMouseEvent | MapTouchEvent) => {
      const d = latest.current.draw
      if (!d) return
      if (!grip) {
        if (e.type !== 'mousemove') return
        m.getCanvas().style.cursor = hitTest(e.point, false) ? 'grab' : d.closed ? '' : 'crosshair'
        if (!d.closed && !d.walking) {
          const s = snap(e.point)
          snapMark = s.snapped ? s.p : null
          paintDraft.current(s.p)
        }
        return
      }
      if (!grip.moved && e.point.dist(grip.from) < DRAG_START_PX) return
      const s = snap(grip.touch ? new maplibregl.Point(e.point.x, e.point.y - TOUCH_LIFT_PX) : e.point)
      snapMark = s.snapped ? s.p : null
      if (grip.kind === 'mid') {
        d.onInsert(grip.index, s.p)
        grip = { ...grip, kind: 'vertex', index: grip.index + 1, moved: true }
      } else {
        grip.moved = true
        d.onDrag(grip.index, s.p)
      }
      m.getCanvas().style.cursor = 'grabbing'
    }
    const onUp = () => {
      const d = latest.current.draw
      const held = grip
      grip = null
      if (!held) return
      m.dragPan.enable()
      lastGripEnd = performance.now()
      snapMark = null
      if (!d) return
      if (held.moved) { d.onDragEnd(); return }
      if (held.kind === 'mid') {
        const [a, b] = edgesOf(d)[held.index]
        d.onInsert(held.index, midpoint(a, b))
        d.onDragEnd()
      } else if (held.index === 0 && !d.closed && d.points.length >= 3) d.onClose()
      else d.onPick(held.index === d.selected ? null : held.index)
    }

    m.on('mousedown', onDown)
    m.on('touchstart', onDown)
    m.on('mousemove', onMove)
    m.on('touchmove', onMove)
    m.on('mouseup', onUp)
    m.on('touchend', onUp)
    m.on('touchcancel', onUp)

    m.on('click', (e) => {
      const d = latest.current.draw
      if (!d || d.walking || performance.now() - lastGripEnd < 300) return
      d.onPick(null)
      if (!d.closed) d.onAdd(snap(e.point).p)
    })
    m.on('dblclick', () => {
      const d = latest.current.draw
      if (d && !d.closed && d.points.length >= 3) d.onClose()
    })

    map.current = m
    return () => { m.remove(); map.current = null }
    // The map is created once; live data flows through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    m.setLayoutProperty('satellite', 'visibility', base === 'satellite' ? 'visible' : 'none')
    m.setLayoutProperty('labels', 'visibility', base === 'satellite' ? 'visible' : 'none')
    m.setLayoutProperty('light', 'visibility', base === 'map' ? 'visible' : 'none')
  }, [base, loaded])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m || labelLang.current === lang) return
    labelLang.current = lang
    ;(m.getSource('labels') as maplibregl.RasterTileSource).setTiles([tileUrl('labels', lang)])
    ;(m.getSource('light') as maplibregl.RasterTileSource).setTiles([tileUrl('light', lang)])
  }, [lang, loaded])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    const features: GeoJSON.Feature[] = []
    if (me?.acc) features.push({ type: 'Feature', geometry: accuracyRing(me.p, me.acc), properties: {} })
    if (me) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: me.p }, properties: {} })
    ;(m.getSource('me') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
  }, [me, loaded])

  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    const features: GeoJSON.Feature[] = []
    if (route && route.path.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: route.path }, properties: { kind: 'road' } })
    if (route?.walkIn) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: route.walkIn }, properties: { kind: 'walk' } })
    ;(m.getSource('route') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
  }, [route, loaded])

  // Land polygons
  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    ;(m.getSource('fields') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: fields.filter((f) => f.id !== ghostId).map((f) => ({
        type: 'Feature',
        geometry: f.boundary,
        properties: { id: f.id, color: HEALTH[f.health_status].color, selected: f.id === selectedId },
      })),
    })
  }, [fields, selectedId, loaded, ghostId])

  // Crop markers: the ring shows season progress, the colour shows health.
  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    markers.current.forEach((x) => x.remove())
    markers.current = drawOn ? [] : fields.map((f) => {
      const el = document.createElement('div')
      el.className = `crop-marker${f.id === selectedId ? ' on' : ''}`
      const orb = document.createElement('div')
      const alerting = f.health_status === 'urgent' || f.health_status === 'treat' || f.weather_risk === 'high'
      orb.className = `crop-orb${alerting ? ' alert' : ''}`
      orb.style.setProperty('--c', HEALTH[f.health_status].color)
      orb.style.setProperty('--p', String(f.cycle?.progress.pct ?? 0))
      const inner = document.createElement('span')
      const img = document.createElement('img')
      img.alt = ''
      img.src = cropSrc(f.cycle?.crop)
      inner.appendChild(img)
      orb.appendChild(inner)
      const label = document.createElement('div')
      label.className = 'crop-label'
      label.textContent = showFarmer && f.farmer ? `${f.farmer.name} · ${f.name}` : f.cycle ? `${f.name} · ${pick(f.cycle)}` : f.name
      el.append(orb, label)
      el.addEventListener('click', (e) => { e.stopPropagation(); latest.current.onSelect?.(f) })
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([f.lng, f.lat]).addTo(m)
    })

    // When land sits close together on screen, shrink the orbs and drop labels that would collide.
    const declutter = () => {
      const pts = markers.current.map((x) => m.project(x.getLngLat()))
      const dense = pts.some((a, i) => pts.slice(i + 1).some((b) => a.dist(b) < 72))
      const els = markers.current.map((x) => x.getElement())
      els.forEach((el) => el.classList.toggle('dense', dense))
      const box = (el: Element | null) => el!.getBoundingClientRect()
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const taken = els.map((el) => box(el.querySelector('.crop-orb')))
      els.forEach((el) => {
        const label = el.querySelector<HTMLElement>('.crop-label')!
        const r = box(label)
        const clash = taken.some((o) => hit(r, o))
        label.style.visibility = clash ? 'hidden' : ''
        if (!clash) taken.push(r)
      })
    }
    declutter()
    m.on('moveend', declutter)
    return () => { m.off('moveend', declutter) }
  }, [fields, selectedId, loaded, drawOn, showFarmer, pick])

  // Intro: start from the whole country and fly down to this user's land.
  useEffect(() => {
    const m = map.current
    if (!loaded || !m || flown.current || !fields.length) return
    flown.current = true
    const b = boundsOf(fields)
    if (b) setTimeout(() => m.fitBounds(b, { padding: padding(), maxZoom: 17.5, pitch: 45, bearing: -12, duration: 3200, essential: true }), 250)
  }, [fields, loaded])

  // Boundaries are traced straight down: a tilted view puts corners in the wrong place.
  useEffect(() => {
    const m = map.current
    if (!loaded || !m || !drawOn) return
    m.doubleClickZoom.disable()
    m.touchPitch.disable()
    m.getCanvas().style.cursor = 'crosshair'
    return () => {
      m.doubleClickZoom.enable()
      m.touchPitch.enable()
      m.getCanvas().style.cursor = ''
    }
  }, [loaded, drawOn])

  // Boundary being drawn
  useEffect(() => {
    if (loaded) paintDraft.current()
  }, [draw, loaded])

  return <div ref={box} className="map-root" />
})
