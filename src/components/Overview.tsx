"use client";

import { useMemo, useState } from "react";
import type { EventItem, Job, Pipeline, Snapshot } from "@/lib/types";
import { ago, arr, bothZones, clock, dayKey, num, toMs } from "@/lib/format";
import { itemMs, rowState, taxonomy, eventKey } from "@/lib/derive";
import { Chips, Empty, ExtLink, Lamp, Num, Panel, Skel, Sparkline, Time, useLiveView, useNow, useShowMore, useZone, type Tone } from "./ui";

const toneText: Record<string, string> = {
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  sodium: "text-sodium",
  faint: "text-muted",
  ink: "text-ink",
  live: "text-live",
};

// ---------- KPI hero row ----------

function Kpi({
  label,
  value,
  sub,
  tone = "ink",
  children,
  testid,
}: {
  label: string;
  value: number | null | undefined;
  sub?: React.ReactNode;
  tone?: Tone;
  children?: React.ReactNode;
  testid?: string;
}) {
  return (
    <div className="panel bracket flex min-w-0 flex-col gap-1 px-4 py-3" data-testid={testid}>
      <span className="label">{label}</span>
      <span className={`display text-[2.75rem] font-bold leading-none ${toneText[tone]}`}>
        <Num value={value} />
      </span>
      {children}
      {sub != null && <span className="min-h-[1rem] text-[0.71875rem] text-muted">{sub}</span>}
    </div>
  );
}

export function Kpis({ s, loading }: { s: Snapshot | null; loading: boolean }) {
  const now = useNow(1000);
  const { zone } = useZone();
  const { cpuSeries, status } = useLiveView();
  const k = useMemo(() => {
    const sched = arr(s?.schedule);
    const today = dayKey(now, zone);
    let yt = 0;
    let ig = 0;
    let sch24 = 0;
    let unv24 = 0;
    for (const it of sched) {
      const st = rowState(it);
      const t = itemMs(it);
      if (t == null) continue;
      if ((st === "published" || st === "posted") && t <= now && dayKey(t, zone) === today) {
        if ((it.platform ?? "") === "instagram") ig += 1;
        else yt += 1;
      }
      if (t > now && t <= now + 24 * 3600_000) {
        if (st === "scheduled") sch24 += 1;
        else if (st === "unverified") unv24 += 1;
      }
    }
    return { yt, ig, sch24, unv24 };
  }, [s?.schedule, now, zone]);

  if (loading)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skel key={i} className="h-[7.375rem]" />
        ))}
      </div>
    );
  const p = s?.pipeline ?? {};
  const cpu = s?.system?.cpu_pct ?? null;
  const limit = s?.system?.cpu_limit_pct ?? 75;
  const l2 = s?.machines?.laptop2;
  const l2on = s?.system?.laptop2?.online !== false;
  const active = arr(l2?.renders).filter((r) => ["render", "base", "upload", "queued"].includes(r.stage ?? "")).length;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi label={`Posted today (${zone})`} value={k.yt + k.ig} sub={`YouTube ${k.yt} public · Instagram ${k.ig}`} tone="sodium" testid="kpi-posted" />
      <Kpi
        label="Scheduled, next 24 h"
        value={k.sch24}
        tone={k.sch24 ? "ok" : "ink"}
        sub={k.unv24 ? <span title="uploaded with a slot, but Studio has not confirmed it">+{k.unv24} unverified</span> : "Studio-confirmed only"}
      />
      <Kpi label="Eligible queue" value={p.eligible_to_upload} sub={`${num(p.held)} held back`} />
      <Kpi
        label="Live streams"
        value={p.streams_live}
        tone={(p.streams_live ?? 0) > 0 ? "live" : "ink"}
        sub={`of ${num(p.streams_tracked)} tracked`}
      />
      <Kpi label={`Main CPU · cap ${limit}%`} value={cpu} tone={cpu != null && cpu > limit ? "err" : "ink"} testid="kpi-cpu">
        <Sparkline values={cpuSeries} limit={limit} height={26} label="Main laptop CPU, last 60 s" stale={status !== "live"} />
      </Kpi>
      <Kpi
        label="Laptop 2 CPU"
        value={l2on ? (l2?.load?.cpu ?? null) : null}
        sub={
          !l2on
            ? "offline"
            : `${l2?.load?.temp_c != null ? `${l2.load.temp_c}°C · ` : ""}${active} render${active === 1 ? "" : "s"} active`
        }
        tone={l2?.load?.temp_c != null && l2.load.temp_c >= 85 ? "err" : "ink"}
      />
    </section>
  );
}

// ---------- status taxonomy with drill-down ----------

export function StatusBoard({ s, loading }: { s: Snapshot | null; loading: boolean }) {
  const groups = useMemo(() => taxonomy(s), [s]);
  const [open, setOpen] = useState<string | null>(null);
  const sel = groups.find((g) => g.key === open) ?? null;
  const { shown, toggle } = useShowMore(sel?.rows ?? [], 12);
  return (
    <Panel title="Status" meta={loading ? null : "every item by state; click a count to list it"} bodyClass="p-3">
      {loading ? (
        <Skel className="h-[5.25rem]" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-expanded={open === g.key}
                onClick={() => setOpen((o) => (o === g.key ? null : g.key))}
                title={g.hint}
                className={`flex flex-col items-start gap-0.5 rounded-[3px] border px-3 py-2 text-left transition-colors ${
                  open === g.key ? "border-sodium bg-sodium/[0.08]" : "border-rule bg-raised/50 hover:border-rule-strong"
                }`}
              >
                <span className={`display text-[1.875rem] font-bold leading-none ${g.rows.length ? toneText[g.tone] : "text-faint"}`}>
                  <Num value={g.rows.length} />
                </span>
                <span className="label !text-[0.625rem]">{g.label}</span>
              </button>
            ))}
          </div>
          {sel && (
            <div className="mt-3 rounded-[3px] border border-rule bg-bg/60">
              <div className="sticky top-[7.375rem] z-10 flex items-baseline gap-2 border-b border-rule bg-panel px-3 py-2">
                <span className={`label !text-ink`}>{sel.label}</span>
                <span className="text-[0.6875rem] text-faint">{sel.hint}</span>
              </div>
              {sel.rows.length === 0 ? (
                <p className="px-3 py-3 text-[0.75rem] text-faint">Nothing here right now.</p>
              ) : (
                <ul className="divide-y divide-rule/70 px-3">
                  {shown.map((r) => (
                    <li key={r.key} className="slide-in grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5 text-[0.75rem]">
                      <div className="min-w-0">
                        <ExtLink href={r.href} className="block truncate text-ink">
                          {r.title}
                        </ExtLink>
                        {r.detail && <p className="truncate text-[0.6875rem] text-faint">{r.detail}</p>}
                      </div>
                      {r.at && <Time iso={r.at} className="text-[0.6875rem] text-muted" />}
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-3 pb-2">{toggle}</div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------- live activity: what each job is doing + the event feed ----------

const KIND_STYLE: Record<string, string> = {
  upload: "text-sodium",
  post: "text-[#f08bb0]",
  fail: "text-err",
  error: "text-err",
  discover: "text-ok",
  render: "text-ink",
  restyle: "text-ink",
  system: "text-faint",
};

export function Activity({ jobs, events, loading }: { jobs: Job[] | null | undefined; events: EventItem[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const { zone } = useZone();
  const doing = useMemo(
    () =>
      arr(jobs)
        .filter((j) => j.running && j.last_line)
        .sort((a, b) => (toMs(b.last_line_at) ?? 0) - (toMs(a.last_line_at) ?? 0)),
    [jobs],
  );
  const list = useMemo(() => arr(events), [events]);
  const [kind, setKind] = useState("all");
  const kinds = useMemo(() => ["all", ...[...new Set(list.map((e) => e.kind ?? "other"))].sort()], [list]);
  const shownEvents = kind === "all" ? list : list.filter((e) => (e.kind ?? "other") === kind);
  const { shown, toggle } = useShowMore(doing, 8);
  return (
    <Panel title="Live activity" meta={loading ? null : "what every job is doing now, newest first"} bodyClass="p-0">
      {loading ? (
        <div className="p-4">
          <Skel className="h-[20rem]" />
        </div>
      ) : (
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 border-b border-rule p-3 lg:border-b-0 lg:border-r">
            <h3 className="label mb-2">Now doing</h3>
            {doing.length === 0 ? (
              <Empty>No running job has written a line yet.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5" data-testid="now-doing">
                {shown.map((j) => {
                  const age = now - (toMs(j.last_line_at) ?? now);
                  return (
                    <li key={j.key} className="rounded-[3px] border border-rule bg-raised/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-2 text-[0.75rem]">
                        <Lamp tone={age < 120_000 ? "ok" : age < 15 * 60_000 ? "ink" : "faint"} pulse={age < 10_000} />
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{j.name ?? j.key}</span>
                        <span className="tnum text-[0.6875rem] text-faint">{ago(j.last_line_at, now)}</span>
                      </div>
                      <p key={j.last_line ?? ""} className="line-fresh mt-0.5 truncate font-mono text-[0.6875rem] text-muted" title={j.last_line ?? undefined}>
                        {j.last_line}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {toggle}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
              <h3 className="label">Events</h3>
              <div className="scroll-thin ml-auto overflow-x-auto">
                <Chips value={kind} options={kinds} onChange={setKind} label="Filter events by kind" />
              </div>
            </div>
            <ol
              className="scroll-thin max-h-[27.5rem] min-h-[12.5rem] overflow-y-auto bg-[#0a0807] px-3 py-2 font-mono text-[0.71875rem] leading-[1.6]"
              role="log"
              aria-live="off"
              tabIndex={0}
              data-testid="event-feed"
            >
              {shownEvents.length === 0 ? (
                <li className="text-faint">No events of this kind yet.</li>
              ) : (
                shownEvents.slice(0, 120).map((e) => {
                  const ms = toMs(e.at);
                  return (
                    <li key={eventKey(e)} className="slide-in grid grid-cols-[3.875rem_3.625rem_minmax(0,1fr)] gap-x-2">
                      <time className="tnum text-faint" dateTime={e.at ?? undefined} title={bothZones(e.at)}>
                        {ms == null ? "--:--:--" : clock(ms, zone)}
                      </time>
                      <span className={`truncate font-semibold uppercase ${KIND_STYLE[e.kind ?? ""] ?? "text-muted"}`}>{e.kind}</span>
                      <span className="break-words text-ink/90">
                        <span className="text-faint">{e.source} </span>
                        {e.text}
                      </span>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ---------- every pipeline count, with what it means ----------

export function PipelineCounts({ p, loading }: { p: Pipeline | null | undefined; loading: boolean }) {
  const pp = p ?? {};
  const rows: [string, number | null | undefined, string][] = [
    ["Streams tracked", pp.streams_tracked, "streams in state.json"],
    ["Live now", pp.streams_live, "live_status is_live at the last stream-meta refresh"],
    [`Blocks this round${pp.blocks_round ? ` (#${pp.blocks_round})` : ""}`, pp.blocks_pending, "queued when the current clip-run round started, not a live countdown"],
    ["Clips cut", pp.clips_total, "every clip in state.json"],
    ["Clips ready", pp.clips_ready, "status ready or approved (held ones included)"],
    ["Restyled", pp.restyled, "in the new style (only clips that still exist)"],
    ["To re-render", pp.rerender_pending, "waiting for the restyle"],
    ["Held", pp.held, "ready clips kept out of uploads by hold.json"],
    ["SEO v3", pp.seo_v3, "titles rewritten by the hard SEO pass"],
    ["Reels built", pp.reels_built, "Instagram packages on disk"],
    ["Eligible", pp.eligible_to_upload, "pass the uploaders' own gate and not uploaded yet"],
    ["Uploaded to Studio", pp.uploaded_yt, "every YouTube upload in the plans, any state"],
    ["Published (YT)", pp.published_yt, "confirmed public by the public check or the Studio audit"],
    ["Scheduled (YT)", pp.scheduled_yt, "confirmed scheduled by the Studio audit"],
    ["Unverified (YT)", pp.unverified_yt, "uploaded, not confirmed either way yet"],
    ["Problem (YT)", pp.problem_yt, "private / not public / failed"],
    ["Posted (IG)", pp.posted_ig, "Instagram posts with a reel code"],
    ["Problem (IG)", pp.problem_ig, "the audit found the reel broken or missing"],
    ["Disabled account (IG)", pp.disabled_ig, "posts of IG 6000, disabled for good: not counted above"],
  ];
  return (
    <Panel
      title="Pipeline counts"
      meta={
        loading ? null : (
          <>
            Studio audit {pp.studio_audit_at ? <Time iso={pp.studio_audit_at} /> : "not run yet"} · public check{" "}
            {pp.publish_check_at ? <Time iso={pp.publish_check_at} /> : "—"}
          </>
        )
      }
      bodyClass="p-0"
    >
      {loading ? (
        <div className="p-4">
          <Skel className="h-[16.25rem]" />
        </div>
      ) : (
        <table className="w-full text-left text-[0.75rem]">
          <tbody>
            {rows.map(([k, v, d]) => (
              <tr key={k} className="border-b border-rule/60 last:border-b-0">
                <th scope="row" className="px-3 py-1.5 font-semibold text-ink">
                  {k}
                </th>
                <td className="w-16 px-2 py-1.5 text-right">
                  <Num value={v} className="font-semibold text-sodium" />
                </td>
                <td className="hidden px-3 py-1.5 text-[0.6875rem] text-faint sm:table-cell">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
