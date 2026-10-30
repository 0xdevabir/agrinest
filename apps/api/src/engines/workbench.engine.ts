import { buildAdvice, cropStage } from "./advice.engine";
import { buildClimateAlerts } from "./climate.engine";
import { marketHint, priceSeries } from "./market.engine";
import { estimateDetail, type YieldEvent } from "./yield.engine";
import type { Weather } from "./weather.engine";
import { readJson } from "./json-data";

const STAGE_EN: Record<string, string> = {
  nursery: "Seedling",
  tillering: "Tillering",
  panicle: "Panicle initiation",
  flowering: "Flowering",
  maturity: "Maturity",
};

const UREA_SPLITS: [string, number, string, string][] = [
  ["tillering", 60, "কুশির সময় প্রথম ভাগ", "First split at tillering"],
  ["panicle", 50, "থোড়ের সময় দ্বিতীয় ভাগ", "Second split at panicle"],
];

const VARIETY_COPY: Record<string, [string, string]> = {
  "BRRI dhan51": ["১০–১৫ দিন জল সহ্য করে", "Holds up through 10–15 days of floodwater"],
  "BRRI dhan52": ["আকস্মিক বন্যায় ভালো", "A safer pick when flash floods are likely"],
  "BRRI dhan47": ["লবণাক্ত পানিতে ফলন ধরে", "Keeps yield in saline water"],
  "BRRI dhan67": ["দক্ষিণ-পশ্চিমের লবণের জন্য", "Suited to south-west salinity"],
};

const bi = (bn: string, en: string) => ({ bn, en });

type Stage = { id: string; name_bn: string; day_start: number; day_end: number };
type Calendar = { stages: Stage[]; tips_bn: Record<string, string> };

function dayChip(precip: number, tmax: number) {
  if (precip >= 15) return bi("ভারী বৃষ্টি", "Heavy rain");
  if (precip >= 5) return bi("হালকা বৃষ্টি", "Light rain");
  if (tmax >= 36) return bi("গরম", "Hot");
  return bi("শান্ত", "Calm");
}

export function buildWorkbench(input: {
  crop: string;
  variety: string;
  areaHa: number;
  sowingDate: string;
  district: string;
  weather: Weather;
  events: (YieldEvent & { id: string })[];
  listings: { id: string; quantityTon: number; district: string; crop: string }[];
}) {
  const advice = buildAdvice(input.crop, input.sowingDate, input.weather);
  const stage = cropStage(input.crop, input.sowingDate);
  const climate = buildClimateAlerts(input.weather, input.district);
  const y = estimateDetail(input.crop, input.variety, input.areaHa, input.events);
  const hint = marketHint(input.district);
  const calendars = readJson<Record<string, Calendar>>("crop_calendars.json");
  const cal = calendars[input.crop] ?? calendars.rice;
  const precip48 = Number(input.weather.precip_sum_48h_mm ?? 0);
  const days = stage.days_after_sowing;
  const current = cal.stages.find((item) => item.id === stage.stage) ?? cal.stages[cal.stages.length - 1];
  const span = Math.max(1, current.day_end - current.day_start);
  const progress = Math.min(1, Math.max(0, (days - current.day_start) / span));
  const daysLeft = Math.max(0, current.day_end - days);

  const timeline = cal.stages.map((item) => ({
    id: item.id,
    name: bi(item.name_bn, STAGE_EN[item.id] ?? item.id),
    day_start: item.day_start,
    day_end: item.day_end,
    state: days > item.day_end ? "past" : item.id === current.id ? "now" : "next",
    tip: bi(cal.tips_bn[item.id] ?? "", cal.tips_bn[item.id] ?? ""),
  }));

  const why = advice.irrigate
    ? bi(advice.irrigate_bn, "Water today — little rain is expected over the next two days")
    : bi(advice.irrigate_bn, `Skip irrigation — about ${precip48.toFixed(0)} mm of rain is likely in the next 48 hours`);
  const irrigation = {
    decision: advice.irrigate ? "water" : "skip",
    mm: advice.irrigate ? 25 : 0,
    why,
    precip_48h_mm: Math.round(precip48 * 10) / 10,
    days: (input.weather.daily ?? []).map((day) => ({
      date: day.date,
      precip_mm: day.precip_mm,
      temp_max_c: day.temp_max_c,
      chip: dayChip(Number(day.precip_mm ?? 0), Number(day.temp_max_c ?? 0)),
    })),
  };

  let applyToday = false;
  let kgHa = 0;
  const splits = UREA_SPLITS.map(([sid, kg, bn, en]) => {
    const meta = cal.stages.find((item) => item.id === sid)!;
    let status = "later";
    if (days > meta.day_end) status = "done";
    else if (sid === current.id && precip48 < 25) {
      status = "now";
      applyToday = true;
      kgHa = kg;
    } else if (sid === current.id) status = "wait_rain";
    return {
      stage: sid,
      name: bi(meta.name_bn, STAGE_EN[sid] ?? sid),
      kg_per_ha: kg,
      kg_for_field: Math.round(kg * input.areaHa * 10) / 10,
      status,
      label: bi(bn, en),
    };
  });

  const prices = hint.prices;
  const best = prices.length ? prices.reduce((top, row) => (row.price_bdt > top.price_bdt ? row : top)) : null;
  const series = priceSeries(input.district);
  const todayAvg = series.length ? series[series.length - 1].avg : 0;
  const window = series.slice(-7);
  const mean7 = window.reduce((sum, row) => sum + row.avg, 0) / Math.max(1, window.length);
  const quintals = y.mid * 10;
  const nowBdt = Math.round(quintals * todayAvg);
  const waitPrice = Math.max(mean7, todayAvg * 1.03);
  const waitBdt = Math.round(quintals * waitPrice);
  const listed = input.listings.reduce((sum, item) => sum + Number(item.quantityTon || 0), 0);

  const book = readJson<{
    district_tags: Record<string, string[]>;
    flood_tolerant: { id: string; name_bn: string; note_bn?: string }[];
    salt_tolerant: { id: string; name_bn: string; note_bn?: string }[];
  }>("varieties_bn.json");
  const tags = new Set(book.district_tags?.[input.district] ?? []);
  const riskIds = new Set(climate.alerts.map((alert) => alert.risk_id));
  if (riskIds.has("heavy_rain") || riskIds.has("flood_proxy")) tags.add("flood_tolerant");
  const varieties = (
    [
      ["flood_tolerant", book.flood_tolerant ?? []],
      ["salt_tolerant", book.salt_tolerant ?? []],
    ] as const
  ).flatMap(([tag, rows]) =>
    rows.map((row) => {
      const whyCopy = VARIETY_COPY[row.id] ?? [row.note_bn ?? "", row.note_bn ?? ""];
      return {
        id: row.id,
        name: bi(row.name_bn, row.id),
        why: bi(whyCopy[0], whyCopy[1]),
        fits: tags.has(tag),
        tag,
      };
    }),
  );

  const history = [...input.events]
    .filter((event) => event.type === "diagnosis" || event.type === "treatment_logged")
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map((event) => {
      const payload = event.payload ?? {};
      return {
        id: event.id,
        type: event.type,
        created_at: event.createdAt?.toISOString() ?? null,
        disease_id: payload.disease_id,
        name: bi(String(payload.name_bn ?? ""), String(payload.name_en ?? "")),
        confidence: payload.confidence,
        steps: (payload.steps_bn as string[]) ?? [],
        note: payload.chemical_note_bn,
      };
    });

  return {
    precision: {
      summary: bi(advice.summary_bn, advice.summary_bn),
      stage: stage.stage,
      stage_name: bi(stage.stage_bn, STAGE_EN[stage.stage] ?? stage.stage),
      days_after_sowing: days,
      days_left_in_stage: daysLeft,
      progress: Math.round(progress * 100) / 100,
      tasks: [
        { id: "irrigate", title: bi("সেচ", "Irrigation"), detail: irrigation.why, tone: irrigation.decision === "skip" ? "skip" : "do" },
        {
          id: "fertilizer",
          title: bi("সার", "Fertilizer"),
          detail: bi(advice.fertilizer_bn || "আজ সারের জানালা নেই", advice.fertilizer_bn || "No fertilizer window today"),
          tone: applyToday ? "do" : "skip",
        },
        {
          id: "stage",
          title: bi(stage.stage_bn, STAGE_EN[stage.stage] ?? stage.stage),
          detail: bi(stage.tip_bn, stage.tip_bn),
          tone: "info",
        },
      ],
      irrigation,
      fertilizer: {
        apply_today: applyToday,
        kg_per_ha: kgHa,
        kg_for_field: Math.round(kgHa * input.areaHa * 10) / 10,
        rain_blocked: !applyToday && (current.id === "tillering" || current.id === "panicle") && precip48 >= 25,
        splits,
        note: bi(
          "পরিমাণ আনুমানিক। রাসায়নিক দেওয়ার আগে স্থানীয় কৃষি কর্মকর্তাকে জিজ্ঞাসা করুন।",
          "Amounts are estimates. Confirm any chemical with a local agriculture officer.",
        ),
      },
      timeline,
      weather_source: input.weather.source ?? "unknown",
    },
    yield: {
      low: y.low,
      mid: y.mid,
      high: y.high,
      unit: y.unit,
      baseline: y.baseline,
      if_treated_mid: y.if_treated_mid,
      open_stress: y.open_stress,
      t_per_ha: y.t_per_ha,
      variety_factor: y.variety_factor,
      rows: y.rows,
      gap_ton: Math.round(Math.max(0, y.baseline - y.mid) * 1000) / 1000,
      area_ha: input.areaHa,
      variety: input.variety,
    },
    market: {
      action: hint.action,
      reason: bi(hint.reason_bn, hint.reason_bn),
      source: hint.source,
      prices,
      best,
      series,
      today_avg: Math.round(todayAvg),
      mean7: Math.round(mean7),
      now_bdt: nowBdt,
      wait_bdt: waitBdt,
      delta_bdt: waitBdt - nowBdt,
      cap_ton: y.mid,
      listed_ton: Math.round(listed * 1000) / 1000,
      remaining_ton: Math.round(Math.max(0, y.mid - listed) * 1000) / 1000,
      listings: input.listings.map((item) => ({
        id: item.id,
        quantity_ton: item.quantityTon,
        district: item.district,
        crop: item.crop,
      })),
    },
    climate: {
      alerts: climate.alerts.map((alert) => ({
        risk_id: alert.risk_id,
        severity: alert.severity,
        title: bi(alert.title_bn, alert.title_bn),
        action: bi(alert.action_bn, alert.action_bn),
      })),
      varieties,
      outlook: irrigation.days,
      weather_source: climate.weather_source,
    },
    guardian: { latest: history.find((item) => item.type === "diagnosis") ?? null, history: history.slice(0, 12) },
  };
}
