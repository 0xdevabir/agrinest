import { readFileSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../common/paths";

export type PriceRow = {
  date: string;
  district: string;
  market: string;
  crop: string;
  unit: string;
  price_bdt: number;
};

let rowsCache: PriceRow[] | null = null;

export function loadPrices(): PriceRow[] {
  if (rowsCache) return rowsCache;
  const raw = readFileSync(join(DATA_DIR, "dam_prices_seed.csv"), "utf8").trim();
  const [header, ...lines] = raw.split(/\r?\n/);
  const keys = header.split(",");
  rowsCache = lines.filter(Boolean).map((line) => {
    const cells = line.split(",");
    const row = Object.fromEntries(keys.map((key, index) => [key, cells[index]])) as Record<string, string>;
    return {
      date: row.date,
      district: row.district,
      market: row.market,
      crop: row.crop,
      unit: row.unit,
      price_bdt: Number(row.price_bdt),
    };
  });
  return rowsCache;
}

export function pricesForDistrict(district: string, crop = "ধান") {
  const rows = loadPrices();
  let filtered = rows.filter((row) => row.district === district && row.crop === crop);
  if (!filtered.length) filtered = rows.filter((row) => row.crop === crop);
  if (!filtered.length) return { prices: [], source: "seed" };
  const latest = filtered.reduce((max, row) => (row.date > max ? row.date : max), filtered[0].date);
  return {
    prices: filtered
      .filter((row) => row.date === latest)
      .map((row) => ({
        market: row.market,
        crop: row.crop,
        unit: row.unit,
        price_bdt: row.price_bdt,
        date: row.date,
      })),
    source: "seed",
  };
}

export function marketHint(district: string, crop = "ধান") {
  const rows = loadPrices();
  let series = rows.filter((row) => row.district === district && row.crop === crop);
  if (!series.length) series = rows.filter((row) => row.crop === crop);
  const { prices, source } = pricesForDistrict(district, crop);
  if (!series.length) {
    return {
      action: "wait" as const,
      reason_bn: "বাজারের তথ্য পাওয়া যায়নি—কিছুদিন অপেক্ষা করুন",
      prices,
      source,
    };
  }
  const byDate = new Map<string, number[]>();
  for (const row of series) {
    const bucket = byDate.get(row.date) ?? [];
    bucket.push(row.price_bdt);
    byDate.set(row.date, bucket);
  }
  const dates = [...byDate.keys()].sort();
  const latest = dates[dates.length - 1];
  const latestRows = byDate.get(latest) ?? [0];
  const todayAvg = latestRows.reduce((sum, value) => sum + value, 0) / latestRows.length;
  const window = dates.slice(-7);
  const mean7 =
    window.reduce((sum, date) => {
      const values = byDate.get(date) ?? [0];
      return sum + values.reduce((a, b) => a + b, 0) / values.length;
    }, 0) / window.length;
  const sell = todayAvg >= mean7 * 1.02;
  return {
    action: sell ? ("sell" as const) : ("wait" as const),
    reason_bn: sell
      ? `আজকের দাম (${todayAvg.toFixed(0)} টাকা) গত সপ্তাহের গড়ের চেয়ে ভালো—বিক্রি বিবেচনা করুন`
      : `আজকের দাম (${todayAvg.toFixed(0)} টাকা) একটু কম—২–৩ দিন অপেক্ষা করলে ভালো হতে পারে`,
    prices,
    source,
  };
}

export function priceSeries(district: string) {
  const rows = loadPrices();
  let scoped = rows.filter((row) => row.district === district && row.crop === "ধান");
  if (!scoped.length) scoped = rows.filter((row) => row.crop === "ধান");
  const byDate = new Map<string, number[]>();
  for (const row of scoped) {
    const bucket = byDate.get(row.date) ?? [];
    bucket.push(row.price_bdt);
    byDate.set(row.date, bucket);
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => {
      const values = byDate.get(date) ?? [0];
      return { date, avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
    });
}
