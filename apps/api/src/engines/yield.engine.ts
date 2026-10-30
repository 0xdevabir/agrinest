import { readJson } from "./json-data";

const SEVERITY: Record<string, number> = {
  rice_blast: 0.12,
  bacterial_leaf_blight: 0.14,
  brown_spot: 0.08,
  sheath_blight: 0.1,
  unknown: 0.05,
  healthy: 0,
};

const DISEASE_NAMES: Record<string, [string, string]> = {
  rice_blast: ["ব্লাস্ট", "Blast"],
  bacterial_leaf_blight: ["বিএলবি", "Bacterial leaf blight"],
  brown_spot: ["বাদামি দাগ", "Brown spot"],
  sheath_blight: ["শেথ ব্লাইট", "Sheath blight"],
  unknown: ["অনিশ্চিত", "Uncertain"],
  healthy: ["সুস্থ", "Healthy"],
};

export type YieldEvent = {
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: Date | null;
};

export function estimateDetail(crop: string, variety: string, areaHa: number, events: YieldEvent[]) {
  const table = readJson<Record<string, { t_per_ha: number; variety_factors?: Record<string, number> }>>(
    "bbs_yield_baselines.json",
  );
  const base = table[crop] ?? table.rice;
  const factors = base.variety_factors ?? {};
  const vfactor = Number(factors[variety] ?? factors.default ?? 1);
  const baseline = base.t_per_ha * areaHa * vfactor;
  let mid = baseline;
  const drivers: string[] = [];
  const rows: { id: string; pct: number; bn: string; en: string }[] = [];
  const open = new Set<string>();

  const ordered = [...events].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  for (const event of ordered) {
    const payload = event.payload ?? {};
    if (event.type === "diagnosis") {
      const did = String(payload.disease_id ?? "unknown");
      if (did === "healthy") continue;
      const conf = Number(payload.confidence ?? 0.5);
      const sev = (SEVERITY[did] ?? 0.08) * (0.7 + 0.3 * conf);
      mid *= 1 - sev;
      open.add(did);
      const [bn, en] = DISEASE_NAMES[did] ?? [did, did];
      drivers.push(`${did} −${(sev * 100).toFixed(0)}%`);
      rows.push({ id: did, pct: Math.round(-sev * 1000) / 10, bn, en });
    } else if (event.type === "treatment_logged") {
      const recover = open.size ? 0.05 : 0.02;
      mid *= 1 + recover;
      drivers.push(`treatment_logged +${(recover * 100).toFixed(0)}%`);
      rows.push({ id: "treatment", pct: Math.round(recover * 1000) / 10, bn: "চিকিৎসা লগ", en: "Treatment logged" });
      open.clear();
    } else if (event.type === "advice" && payload.followed) {
      mid *= 1.02;
      drivers.push("advice_followed +2%");
      rows.push({ id: "advice", pct: 2, bn: "পরামর্শ মানা হয়েছে", en: "Advice followed" });
    }
  }

  mid = Math.max(mid, baseline * 0.4);
  let ifTreated = mid * (open.size ? 1.05 : 1);
  ifTreated = Math.min(ifTreated, baseline);
  return {
    low: round3(mid * 0.85),
    mid: round3(mid),
    high: round3(mid * 1.15),
    unit: "ton",
    baseline: round3(baseline),
    drivers: drivers.slice(-6),
    rows: rows.slice(-6),
    if_treated_mid: round3(ifTreated),
    open_stress: open.size > 0,
    t_per_ha: base.t_per_ha,
    variety_factor: vfactor,
  };
}

export function estimateYield(crop: string, variety: string, areaHa: number, events: YieldEvent[]) {
  const detail = estimateDetail(crop, variety, areaHa, events);
  return {
    low: detail.low,
    mid: detail.mid,
    high: detail.high,
    unit: detail.unit,
    baseline: detail.baseline,
    drivers: detail.drivers,
  };
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
