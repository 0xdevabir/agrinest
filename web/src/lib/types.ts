export type Health = 'unknown' | 'healthy' | 'watch' | 'treat' | 'urgent'

export type Cycle = {
  id: number
  crop: string
  variety?: string | null
  en: string
  bn: string
  emoji: string
  sown_on: string
  expected_harvest_on: string
  progress: {
    day: number
    total_days: number
    pct: number
    harvest_in_days: number
    ready: boolean
    stage: { id: string; en: string; bn: string }
  }
}

export type Field = {
  id: number
  name: string
  boundary: { type: 'Polygon'; coordinates: number[][][] }
  lat: number
  lng: number
  area_acres: number
  district?: string | null
  upazila?: string | null
  village?: string | null
  health_status: Health
  health_score: number | null
  last_scan_at: string | null
  weather_risk: 'none' | 'low' | 'medium' | 'high'
  farmer: { id: number; name: string; phone: string; village?: string | null } | null
  cycle: Cycle | null
}

export type Scan = {
  id: number
  field_id: number
  note?: string | null
  status: 'pending' | 'reviewed'
  verdict?: Health | null
  reviewer?: string | null
  submitted_by?: string | null
  created_at: string
  photos: string[]
  ai: {
    label: string
    name_en: string
    name_bn: string
    confidence: number
    severity: string
    summary_en: string
    summary_bn: string
    steps_en: string[]
    steps_bn: string[]
    source: string
    chemical_note_en: string
    chemical_note_bn: string
  }
  field?: Field
}

export type Guidance = {
  id: number
  field_id: number
  field_name?: string | null
  priority: 'normal' | 'urgent'
  title: string
  body: string
  due_on?: string | null
  done_at?: string | null
  officer?: string | null
  created_at: string
}

export type Localized = { en: string; bn: string }

export type FieldDetail = Field & {
  weather: null | {
    place?: string
    current: { condition: string; temp_c: number; humidity: number; rain_chance: number; wind_kph: number; icon?: string }
    daily: { day: string; condition: string; high_c: number; rain_chance: number; icon?: string }[]
  }
  weather_synced_at: string | null
  alerts: (Localized & { code: string; level: 'low' | 'medium' | 'high' })[]
  advice: (Localized & { icon: string })[]
  yield: null | { low_kg: number; mid_kg: number; high_kg: number; potential_kg: number; confidence: string; seasons_learned: number }
  next_crops: (Localized & { crop: string; emoji: string; score: number; expected_kg: number; expected_value_bdt: number; reasons: Localized[] })[]
  scans: Scan[]
  guidance: Guidance[]
  history: (Localized & { id: number; crop: string; emoji: string; harvested_on: string | null; actual_yield_kg: number | null })[]
}

export type Crop = Localized & { id: string; emoji: string; days: number; reference_price: number }

export const HEALTH: Record<Health, { color: string; bn: string; en: string }> = {
  healthy: { color: '#4fa35b', bn: 'সুস্থ', en: 'Healthy' },
  watch: { color: '#d9a21b', bn: 'নজরে রাখুন', en: 'Watch' },
  treat: { color: '#e07b2c', bn: 'চিকিৎসা দরকার', en: 'Needs care' },
  urgent: { color: '#d9443f', bn: 'জরুরি', en: 'Urgent' },
  unknown: { color: '#3a9db0', bn: 'স্ক্যান হয়নি', en: 'Not scanned' },
}
