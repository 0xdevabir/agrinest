import { readFileSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../common/paths";

const cache = new Map<string, unknown>();

export function readJson<T>(name: string): T {
  const hit = cache.get(name);
  if (hit) return hit as T;
  const parsed = JSON.parse(readFileSync(join(DATA_DIR, name), "utf8")) as T;
  cache.set(name, parsed);
  return parsed;
}
