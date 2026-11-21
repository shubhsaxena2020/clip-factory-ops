"use client";

import type { Snapshot } from "@/lib/types";
import type { LiveMeta } from "@/lib/derive";
import { clock, dur, toMs, type Zone } from "@/lib/format";
import { Mark } from "./Mark";
import { TruthBadge } from "./Truth";
import { Age, Lamp, Sparkline, pctText, useLiveView, useNow, useZone, type Tone } from "./ui";

export const TABS = [
  { key: "overview", label: "Overview" },
  { key: "publishing", label: "Publishing" },
  { key: "production", label: "Production" },
  { key: "intel", label: "Intel" },
  { key: "analytics", label: "Analytics" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

/** LIVE only while ticks arrive; otherwise how old the newest data is, and why it is not live. */
function liveness(status: string, lastTickAt: number | null, generatedAt: string | null | undefined, now: number) {
  if (status === "live" && lastTickAt && now - lastTickAt < 6_000) {
    return { tone: "live" as Tone, text: "Live", detail: "ticks arrive every 0.5 s from the laptop" };
  }
  const gen = toMs(generatedAt);
  const seen = Math.max(lastTickAt ?? 0, gen ?? 0);
  if (!seen) return { tone: "faint" as Tone, text: status === "connecting" ? "Connecting" : "No data", detail: "nothing received yet" };
  const age = Math.max(0, now - seen);
  const fresh = gen != null && now - gen < 7 * 60_000;
  const why = status === "connecting" ? "connecting" : fresh ? "live link down" : "laptop offline";
  return {
    tone: (fresh ? "warn" : age > 25 * 60_000 ? "err" : "warn") as Tone,
    text: `Last seen ${dur(age)} ago (${why})`,
    detail: fresh
      ? "The laptop's 5-minute snapshot is fresh but the live link is not connected. Retrying."
      : "Nothing can be live while the laptop sleeps, the lid is closed or it is off the network. Showing its last snapshot.",
  };
}

export function Header({
  snapshot,
  loading,
  fetchError,
  tab,
  onTab,
}: {
  snapshot: (Snapshot & { live_meta?: LiveMeta }) | null;
  loading: boolean;
  fetchError: string | null;
  tab: TabKey;
  onTab: (t: TabKey) => void;
}) {
  const now = useNow(1000);
  const { zone, setZone } = useZone();
  const { status, lastTickAt, cpuSeries } = useLiveView();
  const sys = snapshot?.system;
  const meta = snapshot?.live_meta;
  // the SAME overlaid reading the KPI tiles show (lib/derive.ts overlay): never a second source
  const cpu = sys?.cpu_pct ?? null;
  const limit = sys?.cpu_limit_pct ?? 75;
  const l2m = snapshot?.machines?.laptop2;
  const l2 = sys?.laptop2;
  const st = liveness(status, lastTickAt, snapshot?.generated_at, now);
  const isLive = st.tone === "live";
  const l2on = l2?.online !== false;
  const t2 = l2on ? (l2m?.load?.temp_c ?? null) : null;
  const l2cpu = l2on ? (l2m?.load?.cpu ?? null) : null;
  const l2Tone: Tone = !l2 || !l2on ? "faint" : t2 == null ? "ink" : t2 >= 85 ? "err" : t2 >= 78 ? "warn" : "ok";
  const mainOld = meta?.mainAt == null || now - meta.mainAt >= 15_000;
  const l2Old = meta?.l2At == null || now - meta.l2At >= 15_000;

  return (
    <header className="relative z-30 border-b border-rule bg-bg/92 backdrop-blur-md sm:sticky sm:top-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:bg-sodium focus:px-2 focus:text-bg">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[80rem] flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="flex items-baseline gap-2">
            <span className="display text-[1.375rem] font-extrabold uppercase tracking-[0.01em] sm:text-[1.625rem]">Clip Factory</span>
            <span className="text-[0.75rem] font-semibold tracking-[0.18em] text-sodium">{"//"}OPS</span>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          title={st.detail}
          data-testid="live-pill"
          data-live={isLive ? "1" : "0"}
          className={`flex max-w-full items-center gap-2 rounded-[3px] border px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${
            isLive
              ? "border-live/60 bg-live/10 text-live"
              : st.tone === "warn"
                ? "border-warn/45 text-warn"
                : st.tone === "err"
                  ? "border-err/50 bg-err/10 text-err"
                  : "border-rule-strong text-faint"
          }`}
        >
          <Lamp tone={st.tone} pulse={isLive} />
          <span className="tnum truncate">{loading ? "Connecting" : st.text}</span>
          {fetchError && !isLive && <span className="truncate text-err normal-case tracking-normal">· poll failed ({fetchError})</span>}
        </div>
        <TruthBadge truth={snapshot?.truth} now={now} />

        <div className="flex w-full items-center justify-between gap-x-4 gap-y-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-x-5">
          <Clocks now={now} zone={zone} setZone={setZone} />
          <div className="flex min-w-0 flex-col gap-0.5 sm:w-[12.5rem]" title={`Main laptop CPU ${pctText(cpu)}% (Task Manager's % Processor Utility), cap ${limit}%`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="label">
                <span className="hidden sm:inline">Main </span>CPU<span className="hidden sm:inline"> · cap {limit}%</span>
              </span>
              <span className="flex flex-row-reverse items-baseline gap-1.5 sm:flex-row">
                <Age at={meta?.mainAt} now={now} testid="hdr-cpu-age" />
                <span
                  data-testid="hdr-cpu"
                  data-at={meta?.mainAt ?? ""}
                  className={`tnum text-[0.75rem] font-semibold ${mainOld ? "text-faint line-through decoration-faint/40" : cpu != null && cpu > limit ? "text-err" : "text-ink"}`}
                >
                  {pctText(cpu)}%
                </span>
              </span>
            </div>
            <div className="hidden sm:block">
              <Sparkline values={cpuSeries.length ? cpuSeries : cpu != null ? [cpu] : []} limit={limit} height={22} slots={120} label="Main laptop CPU, last 60 s" stale={!isLive} />
            </div>
          </div>
          <div className="flex flex-col gap-1" title={!l2on ? "laptop 2 did not answer the last check" : "laptop 2 (render worker): CPU = its Task Manager's % Processor Time"}>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="label">Laptop 2</span>
              <Age at={meta?.l2At} now={now} testid="hdr-l2-age" />
            </span>
            <span className={`flex items-center gap-2 text-[0.75rem] font-semibold ${l2Old ? "text-faint" : ""}`}>
              <Lamp tone={l2Tone} label={!l2on ? "offline" : "online"} />
              {l2 == null ? (
                <span>—</span>
              ) : !l2on ? (
                <span className="font-normal text-faint">
                  offline{l2.last_temp_c != null ? ` · last ${l2.last_temp_c}°C` : ""}
                </span>
              ) : (
                <span className="tnum">
                  <span data-testid="hdr-l2-cpu">{pctText(l2cpu)}%</span>
                  {t2 == null ? "" : <span data-testid="hdr-l2-temp"> · {t2}°C</span>}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="Sections" className="mx-auto max-w-[80rem] px-4 sm:px-6">
        <ul className="scroll-thin -mb-px mt-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                data-tab={t.key}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  tab === t.key ? "border-sodium text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Clocks({ now, zone, setZone }: { now: number; zone: Zone; setZone: (z: Zone) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col leading-tight">
        {(["IST", "ET"] as const).map((z) => (
          <span key={z} className={`tnum whitespace-nowrap text-[0.8125rem] ${z === zone ? "font-semibold text-ink" : "hidden text-muted sm:block"}`} title={z === "IST" ? "India (Kolkata)" : "US Eastern (New York)"}>
            <span className="label mr-1.5 inline-block w-[1.75rem]">{z}</span>
            {clock(now, z)}
          </span>
        ))}
      </div>
      <div role="group" aria-label="Show times in" className="flex rounded-[3px] border border-rule-strong p-[2px]">
        {(["IST", "ET"] as const).map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={zone === z}
            onClick={() => setZone(z)}
            className={`rounded-[2px] px-2 py-[0.1875rem] text-[0.625rem] font-bold tracking-[0.12em] ${
              zone === z ? "bg-sodium text-[#1a0d04]" : "text-muted hover:text-ink"
            }`}
          >
            {z}
          </button>
        ))}
      </div>
    </div>
  );
}
