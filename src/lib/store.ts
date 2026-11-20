import { get, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HistoryDay, HistoryPoint, Snapshot } from "./types";

// Storage: a private Vercel Blob store in production. Without Blob credentials (local dev) the same
// API is backed by files in ./.local-store, and reads fall back to fixtures/sample-snapshot.json.

const SNAPSHOT_PATH = "snapshot.json";
const SNAPSHOT_TTL_MS = 20_000;
const HISTORY_DAYS = 30;
const TODAY_HISTORY_TTL_MS = 30 * 60_000;

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
const LOCAL_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), ".local-store");

async function readText(pathname: string): Promise<string | null> {
  if (useBlob) {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return await new Response(res.stream).text();
  }
  try {
    return await fs.readFile(/*turbopackIgnore: true*/ path.join(LOCAL_DIR, pathname), "utf8");
  } catch {
    return null;
  }
}

async function writeText(pathname: string, body: string): Promise<void> {
  if (useBlob) {
    await put(pathname, body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  const file = path.join(LOCAL_DIR, pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, "utf8");
}

// ---------- snapshot ----------

let snapCache: { at: number; snapshot: Snapshot | null; storedAt: string | null } | null = null;

async function localFallback(): Promise<Snapshot | null> {
  if (useBlob) return null;
  const candidates = [process.env.LOCAL_SNAPSHOT_PATH, path.join(/*turbopackIgnore: true*/ process.cwd(), "fixtures", "sample-snapshot.json")];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ c, "utf8")) as Snapshot;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function readSnapshot(): Promise<{ snapshot: Snapshot | null; storedAt: string | null }> {
  if (snapCache && Date.now() - snapCache.at < SNAPSHOT_TTL_MS) return snapCache;
  let snapshot: Snapshot | null = null;
  let storedAt: string | null = null;
  const text = await readText(SNAPSHOT_PATH);
  if (text) {
    try {
      const wrapped = JSON.parse(text) as Snapshot & { _stored_at?: string };
      storedAt = wrapped._stored_at ?? null;
      delete wrapped._stored_at;
      snapshot = wrapped;
    } catch {
      snapshot = null;
    }
  }
  if (!snapshot) snapshot = await localFallback();
  snapCache = { at: Date.now(), snapshot, storedAt };
  return snapCache;
}

export async function writeSnapshot(snapshot: Snapshot): Promise<string> {
  const storedAt = new Date().toISOString();
  await writeText(SNAPSHOT_PATH, JSON.stringify({ ...snapshot, _stored_at: storedAt }));
  snapCache = { at: Date.now(), snapshot, storedAt };
  return storedAt;
}

// ---------- daily history rollup ----------

/** Calendar day in IST, the operator's home timezone. */
export function istDate(ms: number): string {
  return new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10);
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

let lastHistoryHour: string | null = null;
const pastDays = new Map<string, HistoryDay | null>(); // immutable once the day is over
let todayCache: { at: number; day: HistoryDay | null } | null = null;

async function readDay(date: string): Promise<HistoryDay | null> {
  const text = await readText(`history/${date}.json`);
  if (!text) return null;
  try {
    return JSON.parse(text) as HistoryDay;
  } catch {
    return null;
  }
}

/** Append one point per hour to history/<IST date>.json. Returns true when it wrote. */
export async function maybeWriteHistory(snapshot: Snapshot, nowMs = Date.now()): Promise<boolean> {
  if (!snapshot.pipeline) return false; // nothing to chart; don't record a misleading zero point
  const hourKey = new Date(nowMs).toISOString().slice(0, 13);
  if (lastHistoryHour === hourKey) return false;
  const date = istDate(nowMs);
  const day = (await readDay(date)) ?? { date, points: [] };
  if (day.points.some((p) => p.at.slice(0, 13) === hourKey)) {
    lastHistoryHour = hourKey;
    return false;
  }
  const p = snapshot.pipeline ?? {};
  const point: HistoryPoint = {
    at: new Date(nowMs).toISOString(),
    uploaded_yt: n(p.uploaded_yt),
    posted_ig: n(p.posted_ig),
    scheduled_yt: n(p.scheduled_yt),
    clips_total: n(p.clips_total),
    restyled: n(p.restyled),
    eligible_to_upload: n(p.eligible_to_upload),
  };
  day.points.push(point);
  await writeText(`history/${date}.json`, JSON.stringify(day));
  lastHistoryHour = hourKey;
  todayCache = { at: Date.now(), day };
  return true;
}

export async function readHistory(nowMs = Date.now()): Promise<HistoryDay[]> {
  const today = istDate(nowMs);
  const dates: string[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 1; i--) dates.push(istDate(nowMs - i * 86_400_000));
  const missing = dates.filter((d) => !pastDays.has(d));
  await Promise.all(
    missing.map(async (d) => {
      try {
        pastDays.set(d, await readDay(d));
      } catch {
        /* leave uncached, retry next time */
      }
    }),
  );
  if (!todayCache || Date.now() - todayCache.at > TODAY_HISTORY_TTL_MS || todayCache.day?.date !== today) {
    try {
      todayCache = { at: Date.now(), day: await readDay(today) };
    } catch {
      todayCache = { at: Date.now(), day: null };
    }
  }
  const out: HistoryDay[] = [];
  for (const d of dates) {
    const day = pastDays.get(d);
    if (day) out.push(day);
  }
  if (todayCache.day) out.push(todayCache.day);
  return out;
}

/** Render timestamp handed to the client so its first render matches the server HTML. */
export function serverTime(): number {
  return Date.now();
}
