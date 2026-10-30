import { readJson } from "./json-data";
import type { Weather } from "./weather.engine";

type Stage = { id: string; name_bn: string; day_start: number; day_end: number };
type Calendar = { stages: Stage[]; urea_windows: string[]; tips_bn: Record<string, string> };

function calendars() {
  return readJson<Record<string, Calendar>>("crop_calendars.json");
}

export function cropStage(crop: string, sowingDate: string, today = new Date()) {
  const start = new Date(`${sowingDate}T00:00:00`);
  const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  const table = calendars();
  const cal = table[crop] ?? table.rice;
  let stage = cal.stages[cal.stages.length - 1];
  for (const item of cal.stages) {
    if (item.day_start <= days && days <= item.day_end) {
      stage = item;
      break;
    }
    if (days < item.day_start) {
      stage = item;
      break;
    }
  }
  return {
    stage: stage.id,
    stage_bn: stage.name_bn,
    days_after_sowing: days,
    urea_windows: cal.urea_windows,
    tip_bn: cal.tips_bn[stage.id] ?? "",
  };
}

export function buildAdvice(crop: string, sowingDate: string, weather: Weather) {
  const stage = cropStage(crop, sowingDate);
  const precip48 = Number(weather.precip_sum_48h_mm ?? 0);
  const irrigate = precip48 < 15;
  const irrigateBn = irrigate
    ? "আজ সেচ দিন—আগামী দুই দিনে পর্যাপ্ত বৃষ্টির সম্ভাবনা কম"
    : `সেচ এড়িয়ে চলুন—আগামী ৪৮ ঘণ্টায় প্রায় ${precip48.toFixed(0)} মিমি বৃষ্টির সম্ভাবনা`;

  let fertilizerBn: string | null = null;
  if (stage.urea_windows.includes(stage.stage) && precip48 < 25) {
    fertilizerBn = `${stage.stage_bn} পর্যায়ে ইউরিয়া সারের উপযুক্ত সময়`;
  } else if (stage.urea_windows.includes(stage.stage)) {
    fertilizerBn = "বৃষ্টির পর সার দিন—আজ নয়";
  }

  let summary = irrigateBn;
  if (fertilizerBn) summary = `${irrigateBn}. ${fertilizerBn}.`;
  else if (stage.tip_bn) summary = `${irrigateBn}. ${stage.tip_bn}`;

  return {
    stage: stage.stage,
    stage_bn: stage.stage_bn,
    irrigate,
    irrigate_bn: irrigateBn,
    fertilizer_bn: fertilizerBn,
    summary_bn: summary,
    weather_source: weather.source ?? "unknown",
  };
}
