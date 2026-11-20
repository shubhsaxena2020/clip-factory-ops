"use client";

import type { Snapshot } from "@/lib/types";
import { ago, clock, dur, toMs, type Zone } from "@/lib/format";
import { Mark } from "./Mark";
import { Lamp, TickMeter, useNow, useZone, type Tone } from "./ui";

export const TABS = [
  { key: "overview", label: "Console" },
  { key: "schedule", label: "Schedule" },
  { key: "queue", label: "Upload queue" },
  { key: "streams", label: "Streams" },
  { key: "research", label: "Research" },
  { key: "analytics", label: "Analytics" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

function freshness(generatedAt: string | null | undefined, now: number): { tone: Tone; text: string; detail: string } {
  const ms = toMs(generatedAt);
  if (ms == null) return { tone: "faint", text: "No data", detail: "no snapshot received" };
  const age = now - ms;
  const a = dur(Math.max(0, age));
  if (age > 15 * 60_000) return { tone: "err", text: `Host offline ${a}`, detail: `last snapshot ${a} ago` };
  if (age > 6 * 60_000) return { tone: "warn", text: `Stale ${a}`, detail: `last snapshot ${a} ago` };
  return { tone: "ok", text: `Live ${a}`, detail: `last snapshot ${a} ago` };
}

export function Header({
  snapshot,
  loading,
  fetchError,
  tab,
  onTab,
}: {
  snapshot: Snapshot | null;
  loading: boolean;
  fetchError: string | null;
  tab: TabKey;
  onTab: (t: TabKey) => void;
}) {
  const now = useNow(1000);
  const { zone, setZone } = useZone();
  const sys = snapshot?.system;
  const cpu = sys?.cpu_pct ?? null;
  const limit = sys?.cpu_limit_pct ?? 75;
  const l2 = sys?.laptop2;
  const fresh = freshness(snapshot?.generated_at, now);
  const t2 = l2?.temp_c ?? null;
  const l2Tone: Tone = !l2 || l2.online === false ? "faint" : t2 == null ? "ink" : t2 >= 85 ? "err" : t2 >= 78 ? "warn" : "ok";

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg/92 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:bg-sodium focus:px-2 focus:text-bg">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="flex items-baseline gap-2">
            <span className="display text-[26px] font-extrabold uppercase tracking-[0.01em]">Clip Factory</span>
            <span className="text-[12px] font-semibold tracking-[0.18em] text-sodium">{"//"}OPS</span>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          title={fresh.detail}
          className={`flex items-center gap-2 rounded-[3px] border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            fresh.tone === "ok"
              ? "border-ok/35 text-ok"
              : fresh.tone === "warn"
                ? "border-warn/45 text-warn"
                : fresh.tone === "err"
                  ? "border-err/50 bg-err/10 text-err"
                  : "border-rule-strong text-faint"
          }`}
        >
          <Lamp tone={fresh.tone} pulse={fresh.tone === "ok"} />
          <span className="tnum">{loading ? "Connecting" : fresh.text}</span>
          {fetchError && <span className="text-err normal-case tracking-normal">· poll failed ({fetchError})</span>}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <Clocks now={now} zone={zone} setZone={setZone} />
          <div className="flex w-[210px] flex-col gap-1" title={`CPU ${cpu ?? "—"}% against a ${limit}% cap`}>
            <div className="flex items-baseline justify-between">
              <span className="label">CPU / cap {limit}%</span>
              <span className={`tnum text-[12px] font-semibold ${cpu != null && cpu > limit ? "text-err" : "text-ink"}`}>
                {cpu == null ? "—" : `${cpu.toFixed(0)}%`}
              </span>
            </div>
            <TickMeter value={cpu} max={100} limit={limit} ticks={50} height={12} label="Main laptop CPU" />
          </div>
          <div className="flex flex-col gap-1" title={l2?.job ? `laptop 2 running ${l2.job}` : "laptop 2"}>
            <span className="label">Laptop 2</span>
            <span className="flex items-center gap-2 text-[12px] font-semibold">
              <Lamp tone={l2Tone} label={l2?.online === false ? "offline" : "online"} />
              <span className="tnum">{l2 == null ? "—" : l2.online === false ? "offline" : t2 == null ? "online" : `${t2}°C`}</span>
              {l2?.last_seen && <span className="font-normal text-faint">{ago(l2.last_seen, now)}</span>}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="Sections" className="mx-auto max-w-[1680px] px-4 sm:px-6">
        <ul className="scroll-thin -mb-px mt-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${
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
    <div className="flex items-center gap-4">
      {(["IST", "ET"] as const).map((z) => (
        <div key={z} className="flex flex-col gap-0.5">
          <span className="label">{z === "IST" ? "IST · Kolkata" : "ET · New York"}</span>
          <span className={`tnum text-[15px] font-semibold ${z === zone ? "text-ink" : "text-muted"}`}>{clock(now, z)}</span>
        </div>
      ))}
      <div role="group" aria-label="Show times in" className="flex rounded-[3px] border border-rule-strong p-[2px]">
        {(["IST", "ET"] as const).map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={zone === z}
            onClick={() => setZone(z)}
            className={`rounded-[2px] px-2 py-[3px] text-[10px] font-bold tracking-[0.12em] ${
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
