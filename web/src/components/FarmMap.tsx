'use client'

import maplibregl, { type LngLatBoundsLike, type Map as MapLibre, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getToken } from '@/lib/api'
import { useApp } from '@/lib/app'
import { HEALTH, type Field } from '@/lib/types'

export type MapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void
  fitAll: () => void
  center: () => [number, number]
}

type Props = {
  fields: Field[]
  selectedId?: number | null
  onSelect?: (f: Field) => void
  /** In draw mode, taps add boundary points instead of selecting land. */
  draw?: { points: number[][]; onAdd: (p: number[]) => void }
  showFarmer?: boolean
}

const BD_CENTER: [number, number] = [90.4, 23.9]
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection

function boundsOf(fields: Field[]): LngLatBoundsLike | null {
  const pts = fields.flatMap((f) => f.boundary.coordinates[0])
  if (!pts.length) return null
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

export const FarmMap = forwardRef<MapHandle, Props>(function FarmMap({ fields, selectedId, onSelect, draw, showFarmer }, ref) {
  const { pick } = useApp()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const markers = useRef<Marker[]>([])
  const drawMarkers = useRef<Marker[]>([])
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
    flyTo: (lng, lat, zoom = 16.5) => map.current?.flyTo({ center: [lng, lat], zoom, pitch: 50, speed: 1.2, padding: padding(), essential: true }),
    fitAll: () => {
      const b = boundsOf(latest.current.fields)
      if (b) map.current?.fitBounds(b, { padding: padding(), maxZoom: 17.5, pitch: 45, duration: 1200 })
    },
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
            tiles: [`${window.location.origin}/api/map/tiles/satellite/{z}/{x}/{y}`],
            tileSize: 256,
            maxzoom: 20,
            attribution: 'Atlas · Map data ©Google',
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
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

      m.addSource('draft', { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#96eefb', 'fill-opacity': 0.3 } })
      m.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [2, 1] } })

      m.on('click', 'field-fill', (e) => {
        if (latest.current.draw) return
        const id = e.features?.[0]?.properties?.id
        const f = latest.current.fields.find((x) => x.id === id)
        if (f) latest.current.onSelect?.(f)
      })
      m.on('mouseenter', 'field-fill', () => { if (!latest.current.draw) m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'field-fill', () => { m.getCanvas().style.cursor = '' })
      setLoaded(true)
    })
    m.on('click', (e) => { latest.current.draw?.onAdd([e.lngLat.lng, e.lngLat.lat]) })

    map.current = m
    return () => { m.remove(); map.current = null }
    // The map is created once; live data flows through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Land polygons
  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    ;(m.getSource('fields') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: fields.map((f) => ({
        type: 'Feature',
        geometry: f.boundary,
        properties: { id: f.id, color: HEALTH[f.health_status].color, selected: f.id === selectedId },
      })),
    })
  }, [fields, selectedId, loaded])

  // Crop markers: the ring shows season progress, the colour shows health.
  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    markers.current.forEach((x) => x.remove())
    markers.current = draw ? [] : fields.map((f) => {
      const el = document.createElement('div')
      el.className = `crop-marker${f.id === selectedId ? ' on' : ''}`
      const orb = document.createElement('div')
      const alerting = f.health_status === 'urgent' || f.health_status === 'treat' || f.weather_risk === 'high'
      orb.className = `crop-orb${alerting ? ' alert' : ''}`
      orb.style.setProperty('--c', HEALTH[f.health_status].color)
      orb.style.setProperty('--p', String(f.cycle?.progress.pct ?? 0))
      const inner = document.createElement('span')
      inner.textContent = f.cycle?.emoji ?? '🟫'
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
  }, [fields, selectedId, loaded, draw, showFarmer, pick])

  // Intro: start from the whole country and fly down to this user's land.
  useEffect(() => {
    const m = map.current
    if (!loaded || !m || flown.current || !fields.length) return
    flown.current = true
    const b = boundsOf(fields)
    if (b) setTimeout(() => m.fitBounds(b, { padding: padding(), maxZoom: 17.5, pitch: 45, bearing: -12, duration: 3200, essential: true }), 250)
  }, [fields, loaded])

  // Boundary being drawn
  useEffect(() => {
    const m = map.current
    if (!loaded || !m) return
    const pts = draw?.points ?? []
    const features: GeoJSON.Feature[] = []
    if (pts.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } })
    else if (pts.length === 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } })
    ;(m.getSource('draft') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
    drawMarkers.current.forEach((x) => x.remove())
    drawMarkers.current = pts.map((p) => {
      const el = document.createElement('div')
      el.className = 'draw-dot'
      return new maplibregl.Marker({ element: el }).setLngLat(p as [number, number]).addTo(m)
    })
  }, [draw?.points, loaded, draw])

  return <div ref={box} className="map-root" />
})
