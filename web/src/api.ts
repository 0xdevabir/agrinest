const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text()
    let message = text || res.statusText
    try {
      const body = JSON.parse(text) as { detail?: unknown }
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      /* keep the raw response */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export type Farmer = {
  id: string
  name: string
  district: string
  phone?: string | null
  lang: string
}

export type Field = {
  id: string
  farmer_id: string
  crop: string
  variety: string
  sowing_date: string
  lat: number
  lon: number
  area_ha: number
  location_label?: string | null
}

export type EventRow = {
  id: string
  field_id: string
  type: string
  payload: Record<string, unknown>
  created_at?: string | null
}

export type Dashboard = {
  farmer: Farmer
  field: Field
  advice?: {
    stage: string
    stage_bn: string
    irrigate: boolean
    irrigate_bn: string
    fertilizer_bn?: string | null
    summary_bn: string
    weather_source: string
  } | null
  climate?: {
    alerts: { risk_id: string; title_bn: string; action_bn: string; severity: string }[]
    variety_hint_bn?: string | null
    weather_source: string
  } | null
  yield_estimate?: {
    low: number
    mid: number
    high: number
    unit: string
    baseline: number
    drivers: string[]
  } | null
  market?: {
    action: 'wait' | 'sell'
    reason_bn: string
    prices: { market: string; crop: string; unit: string; price_bdt: number; date: string }[]
    source: string
  } | null
  latest_diagnosis?: EventRow | null
  events: EventRow[]
}

export type DiagnoseResult = {
  disease_id: string
  name_bn: string
  name_en: string
  confidence: number
  source: string
  steps_bn: string[]
  chemical_note_bn: string
  event: EventRow
}

const FIELD_KEY = 'agrisathi_field_id'
const FARMER_KEY = 'agrisathi_farmer_id'

export function saveSession(farmerId: string, fieldId: string) {
  localStorage.setItem(FARMER_KEY, farmerId)
  localStorage.setItem(FIELD_KEY, fieldId)
  window.dispatchEvent(new Event("agrisathi-session"))
}

export function loadSession() {
  if (typeof window === "undefined") return { farmerId: null, fieldId: null }
  return {
    farmerId: localStorage.getItem(FARMER_KEY),
    fieldId: localStorage.getItem(FIELD_KEY),
  }
}

export const api = {
  health: () => req<{ status: string }>('/api/health'),
  seedRahim: () => req<{ farmer_id: string; field_id: string; message: string }>('/api/seed/rahim', { method: 'POST' }),
  createFarmer: (body: { name: string; district: string; phone?: string }) =>
    req<Farmer>('/api/farmers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  createField: (body: {
    farmer_id: string
    crop?: string
    variety?: string
    sowing_date: string
    area_ha?: number
    location_label?: string
  }) =>
    req<Field>('/api/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  dashboard: (fieldId: string) =>
    req<Dashboard>(`/api/fields/${fieldId}/dashboard?force_seed_weather=true`),
  diagnose: async (fieldId: string, file: File, forceDisease?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (forceDisease) fd.append('force_disease', forceDisease)
    return req<DiagnoseResult>(`/api/fields/${fieldId}/diagnose`, { method: 'POST', body: fd })
  },
  logTreatment: (fieldId: string) =>
    req<EventRow>(`/api/fields/${fieldId}/treatment-logged`, { method: 'POST' }),
  yieldEst: (fieldId: string) =>
    req<NonNullable<Dashboard['yield_estimate']>>(`/api/fields/${fieldId}/yield`),
  marketHint: (fieldId: string) =>
    req<NonNullable<Dashboard['market']>>(`/api/fields/${fieldId}/market-hint`),
  createListing: (fieldId: string, quantity_ton: number) =>
    req(`/api/fields/${fieldId}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_ton }),
    }),
  listings: (district?: string) =>
    req<unknown[]>(`/api/listings${district ? `?district=${encodeURIComponent(district)}` : ''}`),
  workbench: (fieldId: string) =>
    req<import('./work/types').Workbench>(`/api/fields/${fieldId}/workbench?force_seed_weather=true`),
  followTask: (fieldId: string, taskId: string) =>
    req<EventRow>(`/api/fields/${fieldId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'advice', payload: { followed: true, task: taskId } }),
    }),
}

/** Resize image client-side ≤512px before upload */
export async function resizeImageFile(file: File, maxSide = 512): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob failed'))), 'image/jpeg', 0.85),
  )
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}
