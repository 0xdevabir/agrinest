const GUARDIAN = process.env.GUARDIAN_URL || "http://127.0.0.1:8011";
const AGRONOMY = process.env.AGRONOMY_URL || "http://127.0.0.1:8012";

async function postJson<T>(base: string, path: string, body: unknown): Promise<T | null> {
  if (base === "off") return null;
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export type GuardianResult = {
  disease_id: string;
  name_bn: string;
  name_en: string;
  confidence: number;
  source: string;
  steps_bn: string[];
  chemical_note_bn: string;
  severity: string;
  summary_bn?: string;
  polish_source?: string;
  service: string;
};

export async function classifyWithGuardian(bytes: Buffer, filename: string, force?: string | null) {
  if (GUARDIAN === "off") return null;
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), filename || "leaf.jpg");
  if (force) body.append("force_disease", force);
  try {
    const response = await fetch(`${GUARDIAN}/classify`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return (await response.json()) as GuardianResult;
  } catch {
    return null;
  }
}

export type Desk = {
  service: string;
  advice: {
    stage: string;
    stage_bn: string;
    irrigate: boolean;
    irrigate_bn: string;
    fertilizer_bn: string | null;
    summary_bn: string;
    weather_source: string;
  };
  climate_alerts: {
    alerts: { risk_id: string; title_bn: string; action_bn: string; severity: string }[];
    variety_hint_bn: string | null;
    weather_source: string;
  };
  yield_estimate: {
    low: number;
    mid: number;
    high: number;
    unit: string;
    baseline: number;
    drivers: string[];
  };
  precision: Record<string, unknown>;
  yield: Record<string, unknown> & { mid: number };
  climate: Record<string, unknown>;
  guardian: Record<string, unknown>;
};

export function agronomyBody(input: {
  crop: string;
  variety: string;
  areaHa: number;
  sowingDate: string;
  district: string;
  lat: number;
  lon: number;
  forceSeed: boolean;
  events: { id: string; type: string; payload: Record<string, unknown>; createdAt: Date | null }[];
}) {
  return {
    crop: input.crop,
    variety: input.variety,
    area_ha: input.areaHa,
    sowing_date: input.sowingDate,
    district: input.district,
    lat: input.lat,
    lon: input.lon,
    force_seed_weather: input.forceSeed,
    events: input.events.map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      created_at: event.createdAt?.toISOString() ?? null,
    })),
  };
}

export function fetchDesk(body: ReturnType<typeof agronomyBody>) {
  return postJson<Desk>(AGRONOMY, "/desk", body);
}

export function fetchAdvice(body: Record<string, unknown>) {
  return postJson<Desk["advice"] & { service?: string }>(AGRONOMY, "/advice", body);
}

export function fetchClimate(body: Record<string, unknown>) {
  return postJson<Desk["climate_alerts"] & { service?: string }>(AGRONOMY, "/climate", body);
}

export function fetchYield(body: Record<string, unknown>) {
  return postJson<Desk["yield_estimate"] & { service?: string }>(AGRONOMY, "/yield", body);
}
