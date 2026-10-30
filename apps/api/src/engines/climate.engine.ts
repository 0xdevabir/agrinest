import { readJson } from "./json-data";
import type { Weather } from "./weather.engine";

type Variety = { id: string; name_bn: string; note_bn?: string };
type VarietyBook = {
  flood_tolerant: Variety[];
  salt_tolerant: Variety[];
  district_tags: Record<string, string[]>;
};

export function buildClimateAlerts(weather: Weather, district: string) {
  const alerts: { risk_id: string; title_bn: string; action_bn: string; severity: string }[] = [];
  const precip24 = Number(weather.precip_24h_mm ?? 0);
  const precip48 = Number(weather.precip_sum_48h_mm ?? 0);
  const tmax = Number(weather.temp_max_c ?? 0);

  if (precip24 >= 15 || precip48 >= 25) {
    alerts.push({
      risk_id: "heavy_rain",
      title_bn: "ভারী বৃষ্টির ঝুঁকি",
      action_bn: "আইল ও নিকাশ নালা খোলা রাখুন যাতে ক্ষেতে পানি জমে না থাকে",
      severity: precip48 >= 30 ? "high" : "medium",
    });
  }
  if (precip48 >= 40) {
    alerts.push({
      risk_id: "flood_proxy",
      title_bn: "বন্যার মতো জলাবদ্ধতার ঝুঁকি",
      action_bn: "চারা উঁচু জায়গায় সরান এবং বন্যাসহনশীল জাত বিবেচনা করুন",
      severity: "high",
    });
  }
  if (tmax >= 36) {
    alerts.push({
      risk_id: "heat",
      title_bn: "তীব্র গরমের চাপ",
      action_bn: "সকাল/বিকেলে সেচ দিন; দুপুরে জলসেক এড়ান",
      severity: "medium",
    });
  }

  const book = readJson<VarietyBook>("varieties_bn.json");
  const tags = book.district_tags?.[district] ?? [];
  let varietyHint: string | null = null;
  const wet = alerts.some((alert) => alert.risk_id === "flood_proxy" || alert.risk_id === "heavy_rain");
  if (wet && tags.includes("flood_tolerant")) {
    const pick = book.flood_tolerant[0];
    varietyHint = `পরামর্শকৃত জাত: ${pick.name_bn} (${pick.note_bn})`;
  } else if (tags.includes("salt_tolerant")) {
    const pick = book.salt_tolerant[0];
    varietyHint = `লবণাক্ত এলাকায় উপযোগী: ${pick.name_bn}`;
  } else if (alerts.some((alert) => alert.risk_id === "flood_proxy")) {
    const pick = book.flood_tolerant[0];
    varietyHint = `পরামর্শকৃত জাত: ${pick.name_bn} (${pick.note_bn})`;
  }

  return {
    alerts,
    variety_hint_bn: varietyHint,
    weather_source: weather.source ?? "unknown",
  };
}
