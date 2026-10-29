export type Bi = { bn: string; en: string }

export type DayForecast = {
  date: string
  precip_mm: number
  temp_max_c: number
  chip: Bi
}

export type Workbench = {
  precision: {
    summary: Bi
    stage: string
    stage_name: Bi
    days_after_sowing: number
    days_left_in_stage: number
    progress: number
    weather_source: string
    tasks: { id: string; title: Bi; detail: Bi; tone: 'do' | 'skip' | 'info' }[]
    irrigation: {
      decision: 'water' | 'skip'
      mm: number
      why: Bi
      precip_48h_mm: number
      days: DayForecast[]
    }
    fertilizer: {
      apply_today: boolean
      kg_per_ha: number
      kg_for_field: number
      rain_blocked: boolean
      note: Bi
      splits: {
        stage: string
        name: Bi
        kg_per_ha: number
        kg_for_field: number
        status: 'done' | 'now' | 'wait_rain' | 'later'
        label: Bi
      }[]
    }
    timeline: {
      id: string
      name: Bi
      day_start: number
      day_end: number
      state: 'past' | 'now' | 'next'
      tip: Bi
    }[]
  }
  yield: {
    low: number
    mid: number
    high: number
    unit: string
    baseline: number
    if_treated_mid: number
    open_stress: boolean
    t_per_ha: number
    variety_factor: number
    gap_ton: number
    area_ha: number
    variety: string
    rows: { id: string; pct: number; bn: string; en: string }[]
  }
  market: {
    action: 'wait' | 'sell'
    reason: Bi
    source: string
    prices: { market: string; crop: string; unit: string; price_bdt: number; date: string }[]
    best: { market: string; price_bdt: number; unit: string } | null
    series: { date: string; avg: number }[]
    today_avg: number
    mean7: number
    now_bdt: number
    wait_bdt: number
    delta_bdt: number
    cap_ton: number
    listed_ton: number
    remaining_ton: number
    listings: { id: string; quantity_ton: number; district: string; crop: string }[]
  }
  climate: {
    weather_source: string
    alerts: { risk_id: string; severity: string; title: Bi; action: Bi }[]
    varieties: { id: string; name: Bi; why: Bi; fits: boolean; tag: string }[]
    outlook: DayForecast[]
  }
  guardian: {
    latest: {
      id: string
      type: string
      disease_id?: string
      name: Bi
      confidence?: number
      steps: string[]
      note?: string
      created_at?: string | null
    } | null
    history: {
      id: string
      type: string
      disease_id?: string
      name: Bi
      confidence?: number
      created_at?: string | null
    }[]
  }
}

