"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Account, ScheduleItem } from "@/lib/types";
import { arr, bothZones, countdown, dayLabel, TZ, toMs, type Zone } from "@/lib/format";
import { Empty, ExtLink, Panel, Pill, PlatformDot, Skel, Thumb, Time, platformShort, useNow, useZone, type Tone } from "./ui";

const HOUR = 3600_000;

function itemMs(it: ScheduleItem): number | null {
  return toMs(it.slot) ?? toMs(it.done_at);
}

function stateTone(s?: string | null): Tone {
  return s === "failed" ? "err" : s === "scheduled" ? "sodium" : s === "published" || s === "posted" ? "ok" : "faint";
}

// ---------- 48 h timeline ----------

function zoneParts(ms: number, zone: Zone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ[zone], hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  return {
    h: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    m: Number(parts.find((p) => p.type === "minute")?.value ?? 0),
  };
}

export function ScheduleTimeline({
  schedule,
  accounts,
  loading,
}: {
  schedule: ScheduleItem[] | null | undefined;
  accounts: Account[] | null | undefined;
  loading: boolean;
}) {
  const now = useNow(60_000);
  const { zone } = useZone();
  const start = now - 24 * HOUR;
  const end = now + 24 * HOUR;
  const span = end - start;
  const items = arr(schedule);

  const lanes = useMemo(() => {
    const seen = new Map<string, { key: string; platform: string; name: string }>();
    for (const a of arr(accounts)) {
      const p = (a.platform ?? "").toLowerCase();
      seen.set(`${p}:${a.key}`, { key: a.key, platform: p, name: a.name ?? "" });
    }
    for (const it of items) {
      const p = (it.platform ?? "").toLowerCase();
      const k = `${p}:${it.account ?? "?"}`;
      if (!seen.has(k)) seen.set(k, { key: it.account ?? "?", platform: p, name: "" });
    }
    const rank = (p: string) => (p === "youtube" ? 0 : p === "instagram" ? 1 : 2);
    return [...seen.entries()].sort(([, a], [, b]) => rank(a.platform) - rank(b.platform)); // stable: keeps account order
  }, [accounts, items]);

  const ticks = useMemo(() => {
    const out: { ms: number; label: string; day: boolean }[] = [];
    const first = Math.ceil(start / (HOUR / 2)) * (HOUR / 2);
    for (let t = first; t <= end; t += HOUR / 2) {
      const { h, m } = zoneParts(t, zone);
      if (m !== 0 || h % 3 !== 0) continue;
      out.push({ ms: t, label: h === 0 ? dayLabel(t, zone) : `${String(h).padStart(2, "0")}:00`, day: h === 0 });
    }
    return out;
  }, [start, end, zone]);

  // on narrow screens the 48 h strip scrolls; start it centred on NOW
  const scroller = useRef<HTMLDivElement>(null);
  const hasLanes = lanes.length > 0 && !loading;
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 + 52;
  }, [hasLanes]);

  const inWindow = items.filter((it) => {
    const t = itemMs(it);
    return t != null && t >= start && t <= end;
  });

  return (
    <Panel
      title="Schedule, 48 hours"
      meta={loading ? null : `${inWindow.length} posts between 24 h ago and 24 h ahead, axis in ${zone}`}
      right={<Legend />}
      bodyClass="p-0"
    >
      {loading ? (
        <div className="p-4">
          <Skel className="h-[320px]" />
        </div>
      ) : lanes.length === 0 ? (
        <div className="p-4">
          <Empty>Nothing is scheduled or published in this window. Booked uploads and posts appear on one lane per account.</Empty>
        </div>
      ) : (
        <div ref={scroller} className="scroll-thin overflow-x-auto">
          <div className="relative min-w-[920px] px-4 pb-7 pt-2">
            <div className="relative ml-[104px] h-6">
              {ticks.map((t) => (
                <span
                  key={t.ms}
                  className={`tnum absolute top-1 -translate-x-1/2 whitespace-nowrap text-[10px] ${t.day ? "font-semibold text-sodium" : "text-faint"}`}
                  style={{ left: `${((t.ms - start) / span) * 100}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-[104px] right-0">
                {ticks.map((t) => (
                  <span
                    key={t.ms}
                    className={`absolute inset-y-0 w-px ${t.day ? "bg-sodium-deep/70" : "bg-rule/70"}`}
                    style={{ left: `${((t.ms - start) / span) * 100}%` }}
                  />
                ))}
                <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-sodium shadow-[0_0_12px_var(--color-sodium)]" />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-[2px] bg-sodium px-1 text-[9.5px] font-bold text-[#1a0d04]">
                  NOW
                </span>
              </div>
              <ul>
                {lanes.map(([laneKey, lane]) => {
                  const laneItems = inWindow.filter(
                    (it) => `${(it.platform ?? "").toLowerCase()}:${it.account ?? "?"}` === laneKey,
                  );
                  return (
                    <li key={laneKey} className="flex h-[34px] items-center border-b border-rule/60 last:border-b-0">
                      <div className="flex w-[104px] shrink-0 items-center gap-1.5 pr-2" title={lane.name}>
                        <PlatformDot platform={lane.platform} />
                        <span className="text-[10.5px] font-semibold text-muted">{platformShort(lane.platform)}</span>
                        <span className="tnum text-[12.5px] font-semibold">{lane.key}</span>
                      </div>
                      <div className="relative h-full flex-1">
                        {laneItems.map((it, i) => (
                          <Marker key={`${it.clip_id}-${i}`} it={it} left={((itemMs(it)! - start) / span) * 100} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Marker({ it, left }: { it: ScheduleItem; left: number }) {
  const s = it.state ?? "";
  const ig = (it.platform ?? "").toLowerCase() === "instagram";
  const cls =
    s === "failed"
      ? "bg-err border-err"
      : s === "scheduled"
        ? "bg-bg border-sodium"
        : ig
          ? "bg-[#f08bb0] border-[#f08bb0]"
          : "bg-sodium border-sodium";
  const label = `${it.title ?? it.clip_id} — ${s} — ${bothZones(it.slot ?? it.done_at)}`;
  const body = <span className={`block size-[11px] rotate-45 border-2 ${cls}`} />;
  const pos = { left: `${left}%` };
  const safe = it.url && /^https?:\/\//.test(it.url) ? it.url : null;
  return safe ? (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1 hover:scale-125"
      style={pos}
    >
      {body}
    </a>
  ) : (
    <span title={label} aria-label={label} role="img" className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1" style={pos}>
      {body}
    </span>
  );
}

function Legend() {
  const row = (cls: string, text: string) => (
    <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
      <span className={`block size-[8px] rotate-45 border-2 ${cls}`} />
      {text}
    </span>
  );
  return (
    <div className="hidden flex-wrap gap-3 sm:flex">
      {row("bg-sodium border-sodium", "published")}
      {row("bg-[#f08bb0] border-[#f08bb0]", "posted")}
      {row("bg-bg border-sodium", "scheduled")}
      {row("bg-err border-err", "failed")}
    </div>
  );
}

// ---------- list ----------

const FILTERS = ["all", "scheduled", "published", "posted", "failed"] as const;

export function ScheduleList({ schedule, loading }: { schedule: ScheduleItem[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const items = arr(schedule);
  const sorted = useMemo(() => {
    const up = items.filter((i) => i.state === "scheduled").sort((a, b) => (itemMs(a) ?? 0) - (itemMs(b) ?? 0));
    const rest = items.filter((i) => i.state !== "scheduled").sort((a, b) => (itemMs(b) ?? 0) - (itemMs(a) ?? 0));
    return [...up, ...rest];
  }, [items]);
  const shown = f === "all" ? sorted : sorted.filter((i) => i.state === f);

  return (
    <Panel
      title="All posts"
      meta={loading ? null : "upcoming first, then most recent"}
      right={
        <div role="group" aria-label="Filter posts" className="flex flex-wrap gap-1">
          {FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={f === k}
              onClick={() => setF(k)}
              className={`rounded-[2px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
                f === k ? "bg-sodium text-[#1a0d04]" : "text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      }
      bodyClass="p-0"
    >
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[56px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="p-4">
          <Empty>{items.length === 0 ? "No posts booked or published yet." : `No ${f} posts right now.`}</Empty>
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {shown.map((it, i) => {
            const t = stateTone(it.state);
            const yt = (it.platform ?? "").toLowerCase() === "youtube";
            return (
              <li
                key={`${it.clip_id}-${i}`}
                className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2.5 md:grid-cols-[112px_150px_92px_minmax(0,1fr)_110px]"
              >
                <div className="row-span-2 md:row-span-1">
                  {yt && it.thumb && it.state === "published" ? (
                    <Thumb src={it.thumb} alt="" className="w-full rounded-[2px]" />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center rounded-[2px] bg-raised text-[10px] font-semibold text-faint">
                      <span className="flex items-center gap-1.5">
                        <PlatformDot platform={it.platform} />
                        {platformShort(it.platform)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-[12px]">
                  <Time iso={it.slot ?? it.done_at} className="font-semibold text-ink" />
                  {it.state === "scheduled" && <span className="tnum text-[11px] text-sodium">{countdown(it.slot, now)}</span>}
                </div>
                <div className="hidden items-center gap-1.5 text-[12px] md:flex">
                  <PlatformDot platform={it.platform} />
                  <span className="tnum font-semibold">{it.account ?? "—"}</span>
                </div>
                <div className="col-start-2 min-w-0 md:col-start-auto">
                  <ExtLink href={it.url} className="line-clamp-2 text-[12.5px] text-ink">
                    {it.title ?? it.clip_id}
                  </ExtLink>
                  <div className="mt-0.5 flex gap-2 text-[11px] text-faint">
                    <span>{it.creator ?? "—"}</span>
                    <span className="md:hidden">
                      {platformShort(it.platform)} {it.account}
                    </span>
                    <span className="truncate">{it.clip_id}</span>
                  </div>
                </div>
                <div className="col-start-2 md:col-start-auto md:justify-self-end">
                  <Pill tone={t}>{it.state ?? "unknown"}</Pill>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------- compact "up next" for the console ----------

export function UpNext({
  schedule,
  loading,
  onMore,
}: {
  schedule: ScheduleItem[] | null | undefined;
  loading: boolean;
  onMore: () => void;
}) {
  const now = useNow(1000);
  const next = arr(schedule)
    .filter((i) => i.state === "scheduled" && (itemMs(i) ?? 0) >= now - 5 * 60_000)
    .sort((a, b) => (itemMs(a) ?? 0) - (itemMs(b) ?? 0))
    .slice(0, 6);
  return (
    <Panel
      title="Up next"
      right={
        <button type="button" onClick={onMore} className="text-[11px] text-muted underline-offset-2 hover:text-sodium hover:underline">
          Open schedule
        </button>
      }
      bodyClass="px-4 py-2"
    >
      {loading ? (
        <div className="flex flex-col gap-2 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} className="h-8" />
          ))}
        </div>
      ) : next.length === 0 ? (
        <div className="py-2">
          <Empty>No upcoming posts are booked.</Empty>
        </div>
      ) : (
        <ol className="divide-y divide-rule">
          {next.map((it, i) => (
            <li key={`${it.clip_id}-${i}`} className="grid grid-cols-[66px_minmax(0,1fr)] gap-x-3 py-2">
              <span className="tnum text-[13px] font-semibold text-sodium">{countdown(it.slot, now)}</span>
              <div className="min-w-0">
                <p className="truncate text-[12px] text-ink" title={it.title ?? undefined}>
                  {it.title ?? it.clip_id}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-faint">
                  <PlatformDot platform={it.platform} />
                  {it.account} <Time iso={it.slot} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
