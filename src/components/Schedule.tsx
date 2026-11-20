"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Account, ScheduleItem } from "@/lib/types";
import { arr, bothZones, clock, countdown, dayKey, dayLabel, TZ, type Zone } from "@/lib/format";
import { itemMs, rowState, STATE_LABEL } from "@/lib/derive";
import { Chips, Empty, ExtLink, Panel, Pill, PlatformDot, Skel, Thumb, Time, platformShort, useNow, useZone, type Tone } from "./ui";

const HOUR = 3600_000;

function stateTone(s?: string | null): Tone {
  return s === "failed" || s === "problem" ? "err" : s === "scheduled" ? "sodium" : s === "published" || s === "posted" ? "ok" : "faint";
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
          <Skel className="h-[20rem]" />
        </div>
      ) : lanes.length === 0 ? (
        <div className="p-4">
          <Empty>Nothing is scheduled or published in this window. Booked uploads and posts appear on one lane per account.</Empty>
        </div>
      ) : (
        <div ref={scroller} className="scroll-thin overflow-x-auto">
          <div className="relative min-w-[57.5rem] px-4 pb-7 pt-2">
            <div className="relative ml-[6.5rem] h-6">
              {ticks.map((t) => (
                <span
                  key={t.ms}
                  className={`tnum absolute top-1 -translate-x-1/2 whitespace-nowrap text-[0.625rem] ${t.day ? "font-semibold text-sodium" : "text-faint"}`}
                  style={{ left: `${((t.ms - start) / span) * 100}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-[6.5rem] right-0">
                {ticks.map((t) => (
                  <span
                    key={t.ms}
                    className={`absolute inset-y-0 w-px ${t.day ? "bg-sodium-deep/70" : "bg-rule/70"}`}
                    style={{ left: `${((t.ms - start) / span) * 100}%` }}
                  />
                ))}
                <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-sodium shadow-[0_0_12px_var(--color-sodium)]" />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-[2px] bg-sodium px-1 text-[0.59375rem] font-bold text-[#1a0d04]">
                  NOW
                </span>
              </div>
              <ul>
                {lanes.map(([laneKey, lane]) => {
                  const laneItems = inWindow.filter(
                    (it) => `${(it.platform ?? "").toLowerCase()}:${it.account ?? "?"}` === laneKey,
                  );
                  return (
                    <li key={laneKey} className="flex h-[2.125rem] items-center border-b border-rule/60 last:border-b-0">
                      <div className="flex w-[6.5rem] shrink-0 items-center gap-1.5 pr-2" title={lane.name}>
                        <PlatformDot platform={lane.platform} />
                        <span className="text-[0.65625rem] font-semibold text-muted">{platformShort(lane.platform)}</span>
                        <span className="tnum text-[0.78125rem] font-semibold">{lane.key}</span>
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
  const s = rowState(it);
  const ig = (it.platform ?? "").toLowerCase() === "instagram";
  const cls =
    s === "failed" || s === "problem"
      ? "bg-err border-err"
      : s === "scheduled"
        ? "bg-bg border-sodium"
        : s === "unverified"
          ? "bg-bg border-faint border-dashed"
        : ig
          ? "bg-[#f08bb0] border-[#f08bb0]"
          : "bg-sodium border-sodium";
  const label = `${it.title ?? it.clip_id} — ${STATE_LABEL[s] ?? s} — ${bothZones(it.slot ?? it.done_at)}`;
  const body = <span className={`block size-[0.6875rem] rotate-45 border-2 ${cls}`} />;
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
    <span className="flex items-center gap-1.5 text-[0.65625rem] text-muted">
      <span className={`block size-[0.5rem] rotate-45 border-2 ${cls}`} />
      {text}
    </span>
  );
  return (
    <div className="hidden flex-wrap gap-3 sm:flex">
      {row("bg-sodium border-sodium", "published")}
      {row("bg-[#f08bb0] border-[#f08bb0]", "posted")}
      {row("bg-bg border-sodium", "scheduled (Studio)")}
      {row("bg-bg border-faint border-dashed", "unverified")}
      {row("bg-err border-err", "failed / private")}
    </div>
  );
}

// ---------- list, grouped by day then time ----------

const STATES = ["all", "scheduled", "unverified", "published", "posted", "problem", "failed", "disabled"] as const;

export const ScheduleByDay = memo(function ScheduleByDay({
  schedule,
  accounts,
  loading,
}: {
  schedule: ScheduleItem[] | null | undefined;
  accounts: Account[] | null | undefined;
  loading: boolean;
}) {
  const now = useNow(1000);
  const { zone } = useZone();
  const [f, setF] = useState<(typeof STATES)[number]>("all");
  const [acc, setAcc] = useState("all");
  const items = useMemo(() => arr(schedule), [schedule]);
  const accOpts = useMemo(() => {
    const keys = new Set<string>();
    for (const a of arr(accounts)) keys.add(`${platformShort(a.platform)} ${a.key}`);
    for (const it of items) keys.add(`${platformShort(it.platform)} ${it.account ?? "?"}`);
    return ["all", ...[...keys].sort()];
  }, [accounts, items]);
  const counts = useMemo(() => {
    const c: Partial<Record<(typeof STATES)[number], number>> = { all: items.length };
    for (const it of items) {
      const k = rowState(it) as (typeof STATES)[number];
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [items]);
  const days = useMemo(() => {
    const shown = items
      .filter((i) => f === "all" || rowState(i) === f)
      .filter((i) => acc === "all" || `${platformShort(i.platform)} ${i.account ?? "?"}` === acc)
      .sort((a, b) => (itemMs(b) ?? 0) - (itemMs(a) ?? 0)); // newest day first, latest time first
    const m = new Map<string, { label: string; rows: ScheduleItem[] }>();
    for (const it of shown) {
      const t = itemMs(it);
      const k = t == null ? "unknown" : dayKey(t, zone);
      const cur = m.get(k) ?? { label: t == null ? "No time" : dayLabel(t, zone), rows: [] };
      cur.rows.push(it);
      m.set(k, cur);
    }
    return [...m.entries()];
  }, [items, f, acc, zone]);
  const today = dayKey(now, zone);

  return (
    <Panel title="Posts by day" meta={loading ? null : `newest day first, then by time (${zone})`} bodyClass="p-0">
      <div className="flex flex-col gap-2 border-b border-rule px-4 py-2">
        <Chips value={f} options={STATES} onChange={setF} label="Filter posts by state" counts={counts} />
        <div className="scroll-thin overflow-x-auto">
          <Chips value={acc} options={accOpts} onChange={setAcc} label="Filter posts by account" />
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[2.75rem]" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="p-4">
          <Empty>{items.length === 0 ? "No posts booked or published yet." : "Nothing matches these filters."}</Empty>
        </div>
      ) : (
        <div className="scroll-thin max-h-[45rem] overflow-y-auto">
          {days.map(([day, g]) => (
            <section key={day}>
              <h3 className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-rule bg-panel/95 px-4 py-1.5 backdrop-blur">
                <span className="label !text-sodium">
                  {g.label}
                  {day === today ? " · today" : ""}
                </span>
                <span className="text-[0.6875rem] text-faint">{g.rows.length} posts</span>
              </h3>
              <ul className="divide-y divide-rule/70">
                {g.rows.map((it, i) => (
                  <PostRow key={`${it.platform}-${it.account}-${it.clip_id}-${i}`} it={it} now={now} zone={zone} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
});

function PostRow({ it, now, zone }: { it: ScheduleItem; now: number; zone: Zone }) {
  const st = rowState(it);
  const t = stateTone(st);
  const yt = (it.platform ?? "").toLowerCase() === "youtube";
  const ms = itemMs(it);
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2 md:grid-cols-[4.5rem_5.375rem_4.375rem_minmax(0,1fr)_10.625rem]">
      <div className="row-span-2 md:row-span-1">
        {yt && it.thumb && st === "published" ? (
          <Thumb src={it.thumb} alt="" className="w-full rounded-[2px]" />
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded-[2px] bg-raised text-[0.625rem] font-semibold text-faint">
            <span className="flex items-center gap-1.5">
              <PlatformDot platform={it.platform} />
              {platformShort(it.platform)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col text-[0.75rem]">
        <span className="tnum font-semibold text-ink" title={bothZones(it.slot ?? it.done_at)}>
          {ms == null ? "—" : clock(ms, zone, false)}
        </span>
        {ms != null && ms > now && <span className="tnum text-[0.6875rem] text-sodium">{countdown(it.slot ?? it.done_at, now)}</span>}
      </div>
      <div className="hidden items-center gap-1.5 text-[0.75rem] md:flex">
        <PlatformDot platform={it.platform} />
        <span className="tnum font-semibold">{it.account ?? "—"}</span>
      </div>
      <div className="col-start-2 min-w-0 md:col-start-auto">
        <ExtLink href={it.url} className="line-clamp-1 text-[0.78125rem] text-ink">
          {it.title ?? it.clip_id}
        </ExtLink>
        <div className="mt-0.5 flex gap-2 text-[0.6875rem] text-faint">
          <span>{it.creator ?? "—"}</span>
          <span className="md:hidden">
            {platformShort(it.platform)} {it.account}
          </span>
          <span className="truncate">{it.clip_id}</span>
        </div>
      </div>
      <div className="col-start-2 flex items-center gap-1.5 md:col-start-auto md:justify-self-end">
        <Pill tone={t} title={it.verified_by ? `checked by ${it.verified_by.replace("_", " ")}` : "no check has confirmed this yet"}>
          {STATE_LABEL[st] ?? st}
        </Pill>
      </div>
    </li>
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
    .filter((i) => ["scheduled", "unverified", "problem"].includes(rowState(i)) && (itemMs(i) ?? 0) >= now - 60_000)
    .sort((a, b) => (itemMs(a) ?? 0) - (itemMs(b) ?? 0))
    .slice(0, 5);
  return (
    <Panel
      title="Next 5 posts"
      right={
        <button type="button" onClick={onMore} className="text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">
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
            <li key={`${it.clip_id}-${i}`} className="slide-in grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 py-2">
              <span className="tnum text-[0.8125rem] font-semibold text-sodium" data-testid="countdown">{countdown(it.slot, now)}</span>
              <div className="min-w-0">
                <p className="truncate text-[0.75rem] text-ink" title={it.title ?? undefined}>
                  {it.title ?? it.clip_id}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-faint">
                  <PlatformDot platform={it.platform} />
                  {it.account} <Time iso={it.slot} />
                  <Pill tone={stateTone(rowState(it))}>{STATE_LABEL[rowState(it)] ?? rowState(it)}</Pill>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
