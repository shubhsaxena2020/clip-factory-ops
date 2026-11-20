"use client";

import { useMemo, useState } from "react";
import type { Analytics, ClaudeUsage as ClaudeT, HistoryDay, PlatformStats, Snapshot } from "@/lib/types";
import { ago, arr, clock, compact, dayLabel, num, toMs } from "@/lib/format";
import { Chips, Empty, ExtLink, Num, Panel, Skel, TickMeter, useNow, useShowMore, useZone } from "./ui";

// ---------- cumulative activity (from the hourly history rollups) ----------

const W = 800;
const H = 220;

export function ActivityChart({ history, snapshot, loading }: { history: HistoryDay[]; snapshot: Snapshot | null; loading: boolean }) {
  const { zone } = useZone();
  const points = useMemo(() => {
    const pts = history.flatMap((d) => arr(d.points)).map((p) => ({ t: toMs(p.at) ?? 0, yt: p.uploaded_yt, ig: p.posted_ig }));
    const gen = toMs(snapshot?.generated_at);
    const pl = snapshot?.pipeline;
    if (gen && pl && (pts.length === 0 || gen > pts[pts.length - 1].t)) {
      pts.push({ t: gen, yt: pl.uploaded_yt ?? 0, ig: pl.posted_ig ?? 0 });
    }
    return pts.filter((p) => p.t > 0).sort((a, b) => a.t - b.t);
  }, [history, snapshot]);

  const last = points[points.length - 1];
  const header = (
    <div className="flex gap-4 text-[0.6875rem]">
      <span className="flex items-center gap-1.5 text-muted">
        <span className="block h-[2px] w-4 bg-sodium" /> YouTube uploads {last ? num(last.yt) : "—"}
      </span>
      <span className="flex items-center gap-1.5 text-muted">
        <span className="block h-[2px] w-4 bg-[#f08bb0]" /> Instagram posts {last ? num(last.ig) : "—"}
      </span>
    </div>
  );

  let body: React.ReactNode;
  if (loading) body = <Skel className="h-[15rem]" />;
  else if (points.length < 2)
    body = (
      <Empty>
        The ingest endpoint records one point per hour. The chart draws once two points exist, so give it an hour after the
        first snapshot arrives.
      </Empty>
    );
  else {
    const t0 = points[0].t;
    const t1 = Math.max(points[points.length - 1].t, t0 + 1);
    const max = Math.max(1, ...points.map((p) => Math.max(p.yt, p.ig)));
    const yMax = niceCeil(max);
    const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
    const y = (v: number) => H - (v / yMax) * (H - 8);
    const line = (key: "yt" | "ig") => points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const area = `${line("yt")} L${W},${H} L0,${H} Z`;
    const xTicks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
    body = (
      <div className="relative">
        <div className="relative ml-10 h-[15rem]">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-rule/70" style={{ top: `${(1 - f) * ((H - 8) / H) * 100 + (8 / H) * 100}%` }}>
              <span className="tnum absolute -left-10 -top-2 w-8 text-right text-[0.625rem] text-faint">{compact(yMax * f)}</span>
            </div>
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Cumulative uploads and posts over time">
            <defs>
              <linearGradient id="ytFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sodium)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-sodium)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#ytFill)" />
            <path d={line("ig")} fill="none" stroke="#f08bb0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={line("yt")} fill="none" stroke="var(--color-sodium)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="relative ml-10 mt-1 h-4">
          {xTicks.map((t, i) => (
            <span
              key={i}
              className={`tnum absolute whitespace-nowrap text-[0.625rem] text-faint ${
                i === 0 ? "" : i === 4 ? "-translate-x-full" : "-translate-x-1/2"
              } ${i % 2 === 1 ? "hidden sm:block" : ""}`}
              style={{ left: `${(i / 4) * 100}%` }}
            >
              {t1 - t0 < 36 * 3600_000 ? `${clock(t, zone, false)}${i === 0 || i === 4 ? ` ${dayLabel(t, zone).slice(4)}` : ""}` : dayLabel(t, zone)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Panel title="Cumulative uploads, 30 days" meta={loading ? null : `${points.length} hourly points · uploaded to Studio, any state`} right={header}>
      {body}
    </Panel>
  );
}

function niceCeil(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// ---------- Studio analytics ----------

export function AnalyticsPanel({ analytics, loading }: { analytics: Analytics | null | undefined; loading: boolean }) {
  const now = useNow(60_000);
  if (loading)
    return (
      <Panel title="Channel analytics">
        <Skel className="h-[16.25rem]" />
      </Panel>
    );
  if (!analytics)
    return (
      <Panel title="Channel analytics">
        <Empty>No Studio analytics snapshot yet. Views, subscribers and A/B results show here once the analytics job reports.</Empty>
      </Panel>
    );
  const per = arr(analytics.per_account);
  const ab = arr(analytics.ab);
  const top = arr(analytics.top_videos);
  const maxViews = Math.max(1, ...per.map((p) => p.views ?? 0));
  const maxAb = Math.max(1, ...ab.map((a) => a.avg_views ?? 0));
  const t = analytics.totals ?? {};
  return (
    <Panel
      title="Studio analytics export"
      meta={`${analytics.updated ? `export from ${ago(analytics.updated, now)}` : "no export time"} · covers ${per.length} account${per.length === 1 ? "" : "s"} · subscribers not in the export`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["Views", t.views],
              ["Subscribers", t.subs],
              ["Videos", t.videos],
            ].map(([k, v]) => (
              <div key={k as string} className="border-l-2 border-sodium pl-3">
                <dt className="label">{k as string}</dt>
                <dd className="display tnum mt-1 text-[2.375rem] font-bold">{compact(v as number | null)}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="label mb-2">Views by account</h3>
            {per.length === 0 ? (
              <Empty>No per-account numbers.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {per.map((p) => (
                  <li key={p.key} className="grid grid-cols-[3rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-[0.75rem]">
                    <span className="tnum font-semibold">{p.key}</span>
                    <span className="h-[0.625rem] bg-rule/80">
                      <span className="block h-full bg-sodium" style={{ width: `${((p.views ?? 0) / maxViews) * 100}%` }} />
                    </span>
                    <span className="tnum text-right text-muted">
                      {compact(p.views)} <span className="text-faint">· {compact(p.subs)} subs</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="label mb-2">A/B arms, average views</h3>
            {ab.length === 0 ? (
              <Empty>No A/B arms reported.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {ab.map((a) => (
                  <li key={a.arm} className="grid grid-cols-[8.125rem_minmax(0,1fr)_6rem] items-center gap-3 text-[0.75rem]">
                    <span className="truncate text-ink">{a.arm}</span>
                    <span className="h-[0.625rem] bg-rule/80">
                      <span className="block h-full bg-ink/80" style={{ width: `${((a.avg_views ?? 0) / maxAb) * 100}%` }} />
                    </span>
                    <span className="tnum text-right text-muted">
                      {compact(a.avg_views)} <span className="text-faint">n={a.n ?? "—"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="label mb-2">Top videos</h3>
            {top.length === 0 ? (
              <Empty>No top videos yet.</Empty>
            ) : (
              <ol className="flex flex-col divide-y divide-rule">
                {top.map((v, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-1.5 text-[0.75rem]">
                    <span className="tnum w-4 text-faint">{i + 1}</span>
                    <ExtLink href={v.url} className="min-w-0 flex-1 truncate text-ink">
                      {v.title ?? "untitled"}
                    </ExtLink>
                    <span className="tnum text-faint">{v.account}</span>
                    <span className="tnum w-14 text-right text-sodium">{compact(v.views)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------- Claude usage ----------

// Reference scales for the meters. They are display scales, not plan limits.
const REF_5H = 5_000_000;
const REF_DAY = 25_000_000;

export function ClaudeUsage({ claude, loading }: { claude: ClaudeT | null | undefined; loading: boolean }) {
  return (
    <Panel title="Claude usage, this machine">
      {loading ? (
        <Skel className="h-[12.5rem]" />
      ) : !claude ? (
        <Empty>No Claude Code usage in this snapshot.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          <Meter label="5-hour window (scale, not a limit)" value={claude.tokens_5h} max={REF_5H} />
          <Meter label="Today (scale, not a limit)" value={claude.tokens_today} max={REF_DAY} />
          <dl className="grid grid-cols-2 gap-3 border-t border-rule pt-3">
            <div>
              <dt className="label">Sessions today</dt>
              <dd className="display tnum mt-1 text-[1.875rem] font-bold">{num(claude.sessions_today)}</dd>
            </div>
            <div>
              <dt className="label">Output tokens today</dt>
              <dd className="display tnum mt-1 text-[1.875rem] font-bold">{compact(claude.output_tokens_today)}</dd>
            </div>
          </dl>
          <p className="text-[0.65625rem] text-faint">
            Tokens = input + cache writes + output (cache reads excluded), from the Claude Code transcripts on this machine. The
            meter scales (5M per 5 h, 25M per day, growing past that) are reading aids. They are not plan limits.
          </p>
        </div>
      )}
    </Panel>
  );
}

function Meter({ label, value, max: ref }: { label: string; value: number | null | undefined; max: number }) {
  // grow the scale when usage passes the reference so the meter never pins at 100%
  const max = value != null && value > ref ? niceCeil(value * 1.1) : ref;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="tnum text-[0.8125rem]">
          <span className="font-semibold text-ink">{compact(value)}</span>
          <span className="text-faint"> / {compact(max)} scale</span>
        </span>
      </div>
      <TickMeter value={value} max={max} ticks={60} height={16} label={`Claude tokens, ${label}`} />
    </div>
  );
}

// ---------- Shorts stats (yt-dlp on laptop 2, every ~20 min) ----------

const SERIES_COLORS = ["var(--color-sodium)", "#f08bb0", "var(--color-ok)", "var(--color-warn)", "#7fb4ff", "var(--color-ink)"];
const SORTS = ["views", "last hour", "likes", "comments"] as const;

export function ShortsStats({ stats, loading }: { stats: PlatformStats | null | undefined; loading: boolean }) {
  const now = useNow(30_000);
  const { zone } = useZone();
  const [sort, setSort] = useState<(typeof SORTS)[number]>("views");
  const rows = useMemo(() => {
    const r = [...arr(stats?.shorts)];
    const key = sort === "views" ? "views" : sort === "likes" ? "likes" : sort === "comments" ? "comments" : "views_1h";
    return r.sort((a, b) => ((b[key] as number | null) ?? -1) - ((a[key] as number | null) ?? -1));
  }, [stats?.shorts, sort]);
  const { shown, toggle } = useShowMore(rows, 10);
  const series = stats?.series ?? {};
  const accts = Object.keys(series).sort();
  const tot = rows.reduce((a, r) => ({ v: a.v + (r.views ?? 0), l: a.l + (r.likes ?? 0), c: a.c + (r.comments ?? 0) }), { v: 0, l: 0, c: 0 });

  let chart: React.ReactNode = null;
  const pts = accts.flatMap((a) => series[a].map(([t, v]) => ({ t: toMs(t) ?? 0, v })));
  if (pts.length > 1) {
    const t0 = Math.min(...pts.map((p) => p.t));
    const t1 = Math.max(t0 + 1, ...pts.map((p) => p.t));
    const yMax = niceCeil(Math.max(1, ...pts.map((p) => p.v)));
    const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
    const y = (v: number) => H - (v / yMax) * (H - 8);
    chart = (
      <div>
        <div className="relative ml-10 h-[12.5rem]">
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-rule/70" style={{ top: `${(1 - f) * ((H - 8) / H) * 100 + (8 / H) * 100}%` }}>
              <span className="tnum absolute -left-10 -top-2 w-8 text-right text-[0.625rem] text-faint">{compact(yMax * f)}</span>
            </div>
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Views per account over time">
            {accts.map((a, i) => (
              <path
                key={a}
                className="draw-line"
                d={series[a].map(([t, v], j) => `${j ? "L" : "M"}${x(toMs(t) ?? t0).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
        <div className="ml-10 mt-1 flex justify-between text-[0.625rem] text-faint">
          <span className="tnum">{dayLabel(t0, zone).slice(4)} {clock(t0, zone, false)}</span>
          <span className="tnum">{dayLabel(t1, zone).slice(4)} {clock(t1, zone, false)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[0.6875rem]">
          {accts.map((a, i) => (
            <span key={a} className="flex items-center gap-1.5 text-muted">
              <span className="block h-[2px] w-4" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              YT {a} {compact(series[a][series[a].length - 1]?.[1])}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Panel
      title="Shorts performance"
      meta={
        loading
          ? null
          : stats?.updated
            ? `public YouTube counts via yt-dlp on laptop 2, every ${stats.every_min ?? 20} min · read ${ago(stats.updated, now)}`
            : "waiting for the first stats pass (yt-dlp on laptop 2, every 20 min)"
      }
    >
      {loading ? (
        <Skel className="h-[16.25rem]" />
      ) : rows.length === 0 ? (
        <Empty>No Short has stats yet. The first pass runs within 20 minutes of the exporter starting.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Views", tot.v],
                ["Likes", tot.l],
                ["Comments", tot.c],
              ].map(([k, v]) => (
                <div key={k as string} className="border-l-2 border-sodium pl-3">
                  <dt className="label">{k as string}</dt>
                  <dd className="display mt-1 text-[2.125rem] font-bold">
                    <Num value={v as number} />
                  </dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="label mb-2">Views per account over time</h3>
              {chart ?? <p className="text-[0.75rem] text-faint">The trend draws after two stats passes.</p>}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="label">Top Shorts</h3>
              <div className="ml-auto">
                <Chips value={sort} options={SORTS} onChange={setSort} label="Sort Shorts by" />
              </div>
            </div>
            <ol className="divide-y divide-rule">
              {shown.map((r, i) => (
                <li key={r.short} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2 py-1.5 text-[0.75rem]">
                  <span className="tnum text-faint">{i + 1}</span>
                  <div className="min-w-0">
                    <ExtLink href={`https://youtube.com/shorts/${r.short}`} className="block truncate text-ink">
                      {r.title ?? r.short}
                    </ExtLink>
                    <span className="text-[0.65625rem] text-faint">
                      YT {r.account} · {r.availability ?? "?"} · {compact(r.likes)} likes · {r.comments == null ? "—" : compact(r.comments)} comments
                    </span>
                  </div>
                  <span className="text-right">
                    <span className="tnum font-semibold text-sodium">{compact(r.views)}</span>
                    {r.views_1h != null && r.views_1h > 0 && <span className="tnum block text-[0.65625rem] text-ok">+{compact(r.views_1h)}/h</span>}
                  </span>
                </li>
              ))}
            </ol>
            {toggle}
          </div>
        </div>
      )}
    </Panel>
  );
}
