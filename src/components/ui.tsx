"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { bothZones, stamp, type Zone } from "@/lib/format";

// ---------- shared clock + zone ----------

export const ZoneCtx = createContext<{ zone: Zone; setZone: (z: Zone) => void }>({ zone: "IST", setZone: () => {} });
export const useZone = () => useContext(ZoneCtx);

/** Server passes its render time so the first client render matches the HTML exactly. */
export const InitialNowCtx = createContext<number>(0);

export function useNow(intervalMs = 1000): number {
  const initial = useContext(InitialNowCtx);
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
      <header className="flex min-h-[42px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2">
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
      className={`inline-block size-[7px] shrink-0 rounded-full ${toneBg[tone]} ${pulse ? "lamp-pulse" : ""}`}
      style={{ boxShadow: tone === "faint" ? undefined : "0 0 8px currentColor" }}
    />
  );
}

export function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-current/35 px-1.5 py-[1px] text-[10px] font-semibold uppercase leading-[16px] tracking-[0.1em] ${toneText[tone]}`}
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
    <div className="flex min-h-[88px] flex-col items-start justify-center gap-2 rounded-[3px] border border-dashed border-rule-strong px-4 py-5 text-[12px] text-muted">
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
      <div className={`grid aspect-video place-items-center bg-raised text-[10px] uppercase tracking-[0.1em] text-faint ${className}`}>
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
