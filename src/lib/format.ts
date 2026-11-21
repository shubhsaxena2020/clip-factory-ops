export type Zone = "IST" | "ET";

export const TZ: Record<Zone, string> = { IST: "Asia/Kolkata", ET: "America/New_York" };

export function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  // Tolerate "2026-11-20 16:36" style local strings from older state files (assume IST).
  const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso.replace(" ", "T") + "+05:30" : iso;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(zone: Zone, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = zone + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ[zone], hourCycle: "h23", ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

export function clock(ms: number, zone: Zone, seconds = true): string {
  return fmt(zone, { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) }).format(ms);
}

export function dayLabel(ms: number, zone: Zone): string {
  return fmt(zone, { weekday: "short", day: "2-digit", month: "short" }).format(ms).toUpperCase();
}

/** "21 NOV 06:30" in the chosen zone. */
export function stamp(iso: string | null | undefined, zone: Zone): string {
  const ms = toMs(iso);
  if (ms == null) return "—";
  const d = fmt(zone, { day: "2-digit", month: "short" }).format(ms).toUpperCase();
  return `${d} ${clock(ms, zone, false)}`;
}

/** Both zones, for title/hover text. */
export function bothZones(iso: string | null | undefined): string {
  const ms = toMs(iso);
  if (ms == null) return "";
  return `${stamp(iso, "IST")} IST  ·  ${stamp(iso, "ET")} ET`;
}

/** Day key (YYYY-MM-DD) in a zone. */
export function dayKey(ms: number, zone: Zone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ[zone], year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function ago(iso: string | null | undefined, now: number): string {
  const ms = toMs(iso);
  if (ms == null) return "—";
  return dur(now - ms, true);
}

export function dur(deltaMs: number, suffix = false): string {
  const future = deltaMs < 0;
  const s = Math.abs(deltaMs) / 1000;
  let out: string;
  if (s < 60) out = `${Math.floor(s)}s`;
  else if (s < 3600) out = `${Math.floor(s / 60)}m`;
  else if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    out = m ? `${h}h ${m}m` : `${h}h`;
  } else out = `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (!suffix) return out;
  return future ? `in ${out}` : `${out} ago`;
}

export function countdown(iso: string | null | undefined, now: number): string {
  const ms = toMs(iso);
  if (ms == null) return "—";
  const d = ms - now;
  if (d <= 0) return "due";
  const s = Math.floor(d / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function compact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(0) + "K";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}

export function pct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : `${Math.round(v)}%`;
}

export const arr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

const partsFmt = new Map<string, Intl.DateTimeFormat>();
/** Wall-clock parts of an instant in an IANA zone. */
export function zoneParts(ms: number, tz: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    partsFmt.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(ms)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, mo: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** The instant (UTC ms) when the wall clock in `tz` shows y-mo-d h:mi. */
export function zonedMs(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = (ms: number) => {
    const p = zoneParts(ms, tz);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
  };
  const o1 = off(guess);
  const t = guess - o1;
  const o2 = off(t);
  return o2 === o1 ? t : guess - o2;
}
