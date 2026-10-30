import { readJson } from "./json-data";

const CACHE_TTL = 1800_000;
const cache = new Map<string, { at: number; data: Weather }>();

export type WeatherDay = {
  date: string;
  precip_mm: number;
  temp_max_c: number;
  temp_min_c: number | null;
};

export type Weather = {
  precip_sum_48h_mm: number;
  precip_24h_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  daily: WeatherDay[];
  source: string;
};

export async function getWeather(lat: number, lon: number, forceSeed = false): Promise<Weather> {
  if (forceSeed || process.env.AGRISATHI_USE_SEED_WEATHER === "true") {
    return { ...readJson<Weather>("weather_seed.json"), source: "seed" };
  }

  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL) return hit.data;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Dhaka",
    forecast_days: "3",
  });
  const base = process.env.AGRISATHI_OPEN_METEO_BASE || "https://api.open-meteo.com/v1/forecast";
  try {
    const response = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(String(response.status));
    const raw = (await response.json()) as {
      daily?: {
        precipitation_sum?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        time?: string[];
      };
    };
    const daily = raw.daily ?? {};
    const precip = daily.precipitation_sum ?? [0, 0, 0];
    const tmax = daily.temperature_2m_max ?? [30, 30, 30];
    const tmin = daily.temperature_2m_min ?? [22, 22, 22];
    const dates = daily.time ?? [];
    const data: Weather = {
      precip_sum_48h_mm: Number(precip[0] ?? 0) + Number(precip[1] ?? 0),
      precip_24h_mm: Number(precip[0] ?? 0),
      temp_max_c: Number(tmax[0] ?? 30),
      temp_min_c: Number(tmin[0] ?? 22),
      daily: precip.slice(0, 7).map((value, i) => ({
        date: dates[i] ?? "",
        precip_mm: Number(value),
        temp_max_c: Number(tmax[i] ?? 30),
        temp_min_c: tmin[i] === undefined ? null : Number(tmin[i]),
      })),
      source: "open-meteo",
    };
    cache.set(key, { at: now, data });
    return data;
  } catch {
    return { ...readJson<Weather>("weather_seed.json"), source: "seed" };
  }
}
