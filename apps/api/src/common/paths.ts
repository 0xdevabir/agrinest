import { mkdirSync } from "fs";
import { join } from "path";

export const DATA_DIR = join(process.cwd(), "data");
export const PHOTOS_DIR = join(process.cwd(), "uploads", "leaf-photos");

mkdirSync(PHOTOS_DIR, { recursive: true });

export function flag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

export function numFlag(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function queryBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}
