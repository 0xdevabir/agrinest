export type EventType =
  | "diagnosis"
  | "advice"
  | "weather_alert"
  | "treatment_logged"
  | "sale";

export interface Farmer {
  id: string;
  name: string;
  district: string;
  phone?: string | null;
  lang: string;
  created_at?: string | null;
}

export interface Field {
  id: string;
  farmer_id: string;
  crop: string;
  variety: string;
  sowing_date: string;
  lat: number;
  lon: number;
  area_ha: number;
  location_label?: string | null;
}

export interface EventRow {
  id: string;
  field_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at?: string | null;
}

export interface DiagnoseResult {
  disease_id: string;
  name_bn: string;
  name_en: string;
  confidence: number;
  source: string;
  steps_bn: string[];
  chemical_note_bn: string;
  event: EventRow;
}

export interface Advice {
  stage: string;
  stage_bn: string;
  irrigate: boolean;
  irrigate_bn: string;
  fertilizer_bn?: string | null;
  summary_bn: string;
  weather_source: string;
  event: EventRow;
}

export interface ClimateAlert {
  risk_id: string;
  title_bn: string;
  action_bn: string;
  severity: string;
}

export interface Climate {
  alerts: ClimateAlert[];
  variety_hint_bn?: string | null;
  weather_source: string;
  events?: EventRow[];
}

export interface YieldEstimate {
  low: number;
  mid: number;
  high: number;
  unit: string;
  baseline: number;
  drivers: string[];
}

export interface PriceRow {
  market: string;
  crop: string;
  unit: string;
  price_bdt: number;
  date: string;
}

export interface MarketHint {
  action: "wait" | "sell";
  reason_bn: string;
  prices: PriceRow[];
  source: string;
}

export interface Listing {
  id: string;
  field_id: string;
  crop: string;
  quantity_ton: number;
  price_hint_bdt?: number | null;
  district: string;
  notes?: string | null;
  created_at?: string | null;
}

export interface Dashboard {
  farmer: Farmer;
  field: Field;
  advice?: Omit<Advice, "event"> | null;
  climate?: Omit<Climate, "events"> | null;
  yield_estimate?: YieldEstimate | null;
  market?: MarketHint | null;
  latest_diagnosis?: EventRow | null;
  events: EventRow[];
}
