"use client";

import { createContext, memo, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { bothZones, num, stamp, type Zone } from "@/lib/format";

// ---------- motion ----------

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Count-up length. A shown number may trail the real one by at most TWEEN_MS + 100 ms (the timer
 *  below lands it even when animation frames are throttled), within the ~0.6 s budget. */
export const TWEEN_MS = 350;

/** Tween a number toward `target` over `ms` (count-up). Instant when motion is reduced. A timer
 *  sets the exact target at ms + 100 whatever happens to animation frames (busy or background tab). */
export function useTween(target: number | null | undefined, ms = TWEEN_MS): number | null {
  const [v, setV] = useState<number | null>(target ?? null);
  const from = useRef<number | null>(target ?? null);
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) {
      from.current = null;
      const id = requestAnimationFrame(() => setV(null));
      return () => cancelAnimationFrame(id);
    }
    const start = from.current;
    if (start == null || start === target || reducedMotion()) {
      from.current = target;
      const id = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = start + (target - start) * e;
      from.current = cur;
      setV(cur);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    const land = setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = target;
      setV(target);
    }, ms + 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(land);
    };
  }, [target, ms]);
  return v;
}

/** A live reading as text: the SAME function everywhere it is shown (header, KPI tile, machines). */
export function pctText(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : String(Math.round(v));
}

/** How old a live reading is, e.g. "now" / "8 s ago" / "4 min ago", with a tone for its freshness. */
export function ageText(at: number | null | undefined, now: number): { text: string; tone: Tone; stale: boolean } {
  if (at == null) return { text: "no reading", tone: "faint", stale: true };
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return { text: "now", tone: "live", stale: false };
  if (s < 90) return { text: `${s} s ago`, tone: "warn", stale: s >= 15 };
  if (s < 5400) return { text: `${Math.round(s / 60)} min ago`, tone: "err", stale: true };
  return { text: `${Math.round(s / 3600)} h ago`, tone: "err", stale: true };
}

/** "read now · tick" style age label for a live reading. */
export function Age({ at, now, src, testid }: { at: number | null | undefined; now: number; src?: string; testid?: string }) {
  const a = ageText(at, now);
  return (
    <span
      data-testid={testid}
      data-stale={a.stale ? "1" : "0"}
      title={at != null ? `read ${new Date(at).toISOString().replace("T", " ").slice(0, 19)} UTC${src ? ` · from the ${src}` : ""}` : undefined}
      className={`tnum whitespace-nowrap text-[0.625rem] font-semibold normal-case tracking-normal ${toneText[a.tone]}`}
    >
      {a.text === "now" ? "now" : a.text}
      {src ? <span className="font-normal text-faint"> · {src}</span> : null}
    </span>
  );
}

/** A number that counts to its new value and flashes when it changes. */
export function Num({ value, digits = 0, className = "" }: { value: number | null | undefined; digits?: number; className?: string }) {
  const v = useTween(value);
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current != null && value != null && prev.current !== value) {
      const on = requestAnimationFrame(() => setFlash(true));
      const off = setTimeout(() => setFlash(false), 900);
      prev.current = value;
      return () => {
        cancelAnimationFrame(on);
        clearTimeout(off);
      };
    }
    prev.current = value;
  }, [value]);
  const shown = v == null ? null : digits ? v : Math.round(v);
  return <span className={`tnum ${flash ? "num-flash" : ""} ${className}`}>{num(shown, digits)}</span>;
}

/** Progress ring (e.g. today's posts out of the daily slots). Segments: done, booked, unverified. */
export function Ring({
  done,
  booked = 0,
  unverified = 0,
  total,
  size = 46,
  label,
}: {
  done: number;
  booked?: number;
  unverified?: number;
  total: number;
  size?: number;
  label: string;
}) {
  const r = 15.9155; // circumference 100
  const t = Math.max(1, total);
  const seg = (n: number) => Math.max(0, Math.min(100, (n / t) * 100));
  const a = seg(done);
  const b = seg(booked);
  const c = seg(unverified);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-rule-strong)" strokeWidth="3.2" />
      {c > 0 && (
        <circle className="ring-seg" cx="18" cy="18" r={r} fill="none" stroke="var(--color-faint)" strokeWidth="3.2"
          strokeDasharray={`${c} ${100 - c}`} strokeDashoffset={-(a + b)} />
      )}
      {b > 0 && (
        <circle className="ring-seg" cx="18" cy="18" r={r} fill="none" stroke="var(--color-sodium-deep)" strokeWidth="3.2"
          strokeDasharray={`${b} ${100 - b}`} strokeDashoffset={-a} />
      )}
      {a > 0 && (
        <circle className="ring-seg" cx="18" cy="18" r={r} fill="none" stroke="var(--color-sodium)" strokeWidth="3.2"
          strokeDasharray={`${a} ${100 - a}`} strokeDashoffset={0} strokeLinecap="butt" />
      )}
    </svg>
  );
}

/** Rolling sparkline (values 0..max), newest on the right; a dashed line marks `limit`. */
export const Sparkline = memo(function Sparkline({
  values,
  max = 100,
  limit,
  slots = 60,
  height = 36,
  label,
  stale = false,
}: {
  values: number[];
  max?: number;
  limit?: number | null;
  slots?: number;
  height?: number;
  label: string;
  stale?: boolean;
}) {
  const W = 120;
  const H = 30;
  const vs = values.slice(-slots);
  const x = (i: number) => ((i + (slots - vs.length)) / (slots - 1)) * W;
  const y = (v: number) => H - (Math.max(0, Math.min(max, v)) / max) * (H - 2) - 1;
  const d = vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = vs[vs.length - 1];
  const over = limit != null && last != null && last > limit;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={label}>
      {limit != null && (
        <line x1="0" x2={W} y1={y(limit)} y2={y(limit)} stroke="var(--color-err)" strokeOpacity="0.55" strokeDasharray="3 3"
          strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
      {vs.length > 1 && (
        <>
          <path d={`${d} L${x(vs.length - 1)},${H} L${x(0)},${H} Z`} fill="var(--color-sodium)" fillOpacity={stale ? 0.05 : 0.14} />
          <path d={d} fill="none" stroke={stale ? "var(--color-faint)" : over ? "var(--color-err)" : "var(--color-sodium)"}
            strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <circle cx={x(vs.length - 1)} cy={y(last)} r="1.8" fill={stale ? "var(--color-faint)" : "var(--color-sodium)"} className={stale ? "" : "lamp-pulse"} />
        </>
      )}
    </svg>
  );
});

/** Filter / sort chips. */
export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
  counts,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`whitespace-nowrap rounded-[2px] px-2 py-[0.1875rem] text-[0.65625rem] font-semibold uppercase tracking-[0.1em] transition-colors ${
            value === k ? "bg-sodium text-[#1a0d04]" : "text-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {k}
          {counts?.[k] != null && <span className="tnum ml-1 opacity-70">{counts[k]}</span>}
        </button>
      ))}
    </div>
  );
}

/** First `n` items, then a "show N more" toggle. */
export function useShowMore<T>(items: T[], n: number) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, n);
  const rest = items.length - n;
  const toggle =
    rest > 0 ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 w-full rounded-[2px] border border-dashed border-rule-strong py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted hover:border-sodium hover:text-sodium"
      >
        {open ? "Show less" : `Show ${rest} more`}
      </button>
    ) : null;
  return { shown, toggle };
}

/** Live readings overlay, shared by the header and panels. */
export interface LiveView {
  status: "connecting" | "live" | "down" | "nourl";
  lastTickAt: number | null;
  cpuSeries: number[];
}
export const LiveCtx = createContext<LiveView>({ status: "connecting", lastTickAt: null, cpuSeries: [] });
export const useLiveView = () => useContext(LiveCtx);

// ---------- shared clock + zone ----------

export const ZoneCtx = createContext<{ zone: Zone; setZone: (z: Zone) => void }>({ zone: "IST", setZone: () => {} });
export const useZone = () => useContext(ZoneCtx);

/** Server passes its render time so the first client render matches the HTML exactly. */
export const InitialNowCtx = createContext<number>(0);

export function useNow(intervalMs = 1000): number {
  return useNowIn(useContext(InitialNowCtx), intervalMs);
}

/** useNow for components above the InitialNowCtx provider (they pass the server time themselves). */
export function useNowIn(initial: number, intervalMs = 1000): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    // Re-sync shortly after mount (server time may be seconds old), then on the interval.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

// ---------- primitives ----------

export function Panel({
  title,
  meta,
  right,
  children,
  className = "",
  bodyClass = "p-4",
  id,
}: {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-label={title} className={`panel bracket min-w-0 ${className}`}>
      <header className="flex min-h-[2.625rem] flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2">
        <h2 className="label !text-ink">{title}</h2>
        {meta != null && <span className="label !tracking-[0.06em] !normal-case text-faint">{meta}</span>}
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </header>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export type Tone = "ok" | "warn" | "err" | "live" | "sodium" | "faint" | "ink";

const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  live: "text-live",
  sodium: "text-sodium",
  faint: "text-faint",
  ink: "text-ink",
};
const toneBg: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  err: "bg-err",
  live: "bg-live",
  sodium: "bg-sodium",
  faint: "bg-faint",
  ink: "bg-ink",
};

export function Lamp({ tone, pulse = false, label }: { tone: Tone; pulse?: boolean; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block size-[0.4375rem] shrink-0 rounded-full ${toneBg[tone]} ${pulse ? "lamp-pulse" : ""}`}
      style={{ boxShadow: tone === "faint" ? undefined : "0 0 8px currentColor" }}
    />
  );
}

export function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-current/35 px-1.5 py-[1px] text-[0.625rem] font-semibold uppercase leading-[1rem] tracking-[0.1em] ${toneText[tone]}`}
    >
      {children}
    </span>
  );
}

/** Thin tick meter, the signature gauge. Ticks past `limit` are drawn as a no-go zone. */
export function TickMeter({
  value,
  max,
  ticks = 40,
  limit,
  tone = "sodium",
  height = 14,
  label,
}: {
  value: number | null | undefined;
  max: number;
  ticks?: number;
  limit?: number | null;
  tone?: Tone;
  height?: number;
  label: string;
}) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, value);
  const filled = v == null ? 0 : Math.round(Math.min(1, v / max) * ticks);
  const limitTick = limit != null ? Math.round((limit / max) * ticks) : null;
  const over = v != null && limit != null && v > limit;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={v ?? undefined}
      className="flex w-full items-end gap-[2px]"
      style={{ height }}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const on = i < filled;
        const beyond = limitTick != null && i >= limitTick;
        const cls = on
          ? over && beyond
            ? toneBg.err
            : toneBg[tone]
          : beyond
            ? "bg-err/25"
            : "bg-rule-strong/70";
        return <span key={i} className={`h-full min-w-[1px] flex-1 rounded-[1px] ${cls}`} />;
      })}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col items-start justify-center gap-2 rounded-[3px] border border-dashed border-rule-strong px-4 py-5 text-[0.75rem] text-muted">
      <p className="max-w-[62ch]">{children}</p>
      {action}
    </div>
  );
}

export function Skel({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/** A timestamp in the operator's chosen zone, with both zones on hover. */
export function Time({ iso, className = "" }: { iso: string | null | undefined; className?: string }) {
  const { zone } = useZone();
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={bothZones(iso)} className={`tnum whitespace-nowrap ${className}`}>
      {stamp(iso, zone)}
    </time>
  );
}

export function PlatformDot({ platform }: { platform?: string | null }) {
  const p = (platform ?? "").toLowerCase();
  const cls = p === "youtube" ? "bg-yt" : p === "instagram" ? "bg-ig" : p === "twitch" ? "bg-tw" : "bg-faint";
  const name = p === "youtube" ? "YouTube" : p === "instagram" ? "Instagram" : p === "twitch" ? "Twitch" : "Unknown platform";
  return <span role="img" aria-label={name} title={name} className={`inline-block size-2 shrink-0 rounded-[2px] ${cls}`} />;
}

export function platformShort(p?: string | null): string {
  const s = (p ?? "").toLowerCase();
  return s === "youtube" ? "YT" : s === "instagram" ? "IG" : s === "twitch" ? "TW" : "—";
}

export function Thumb({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`grid aspect-video place-items-center bg-raised text-[0.625rem] uppercase tracking-[0.1em] text-faint ${className}`}>
        no thumb
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`aspect-video bg-raised object-cover ${className}`}
    />
  );
}

export function ExtLink({ href, children, className = "" }: { href?: string | null; children: ReactNode; className?: string }) {
  const safe = href && /^https?:\/\//i.test(href) ? href : null;
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className={`hover:text-sodium hover:underline ${className}`}>
      {children}
    </a>
  );
}
