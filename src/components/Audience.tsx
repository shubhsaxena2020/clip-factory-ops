"use client";

import type { FollowerAccount, Followers, Snapshot } from "@/lib/types";
import { ago, arr, compact, num, toMs } from "@/lib/format";
import { Delta } from "./Health";
import { Empty, ExtLink, Lamp, Panel, Skel, Time, useNow, type Tone } from "./ui";

// ---------- subscribers / followers per account ----------

function Trend({ series, label }: { series: [string, number][]; label: string }) {
  const pts = series.map(([t, v]) => [toMs(t) ?? 0, v] as const).filter(([t]) => t > 0);
  if (pts.length < 2) return <span className="block h-[1.75rem] truncate text-[0.625rem] leading-[1.75rem] text-faint">trend: needs 2 readings</span>;
  const W = 120;
  const H = 28;
  const t0 = pts[0][0];
  const t1 = Math.max(pts[pts.length - 1][0], t0 + 1);
  const lo = Math.min(...pts.map((p) => p[1]));
  const hi = Math.max(lo + 1, ...pts.map((p) => p[1]));
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  const d = pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[1.75rem] w-full" role="img" aria-label={label}>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="var(--color-sodium)" fillOpacity="0.12" />
      <path d={d} fill="none" stroke="var(--color-sodium)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const STATUS: Record<string, { tone: Tone; text: string }> = {
  ok: { tone: "ok", text: "read" },
  stale: { tone: "warn", text: "last read failed" },
  blocked: { tone: "warn", text: "Instagram blocks anonymous reads" },
  error: { tone: "err", text: "read failed" },
  disabled: { tone: "faint", text: "disabled for good" },
  pending: { tone: "faint", text: "not read yet" },
};

function Card({ f, now }: { f: FollowerAccount; now: number }) {
  const ig = f.platform === "ig";
  const st = STATUS[f.status ?? "pending"] ?? STATUS.pending;
  const disabled = f.status === "disabled";
  return (
    <li className={`flex min-w-0 flex-col gap-1 rounded-[3px] border border-rule bg-raised/50 px-3 py-2.5 ${disabled ? "opacity-55" : ""}`} data-testid={`followers-${f.platform}-${f.key}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block size-2 shrink-0 rounded-[2px] ${ig ? "bg-ig" : "bg-yt"}`} aria-hidden />
        <span className="text-[0.65625rem] font-semibold text-muted">{ig ? "IG" : "YT"}</span>
        <span className="tnum text-[0.8125rem] font-semibold">{f.key}</span>
        <span className="ml-auto" title={f.error ?? f.note ?? st.text}>
          <Lamp tone={st.tone} label={st.text} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`display text-[2rem] font-bold leading-none ${f.count == null ? "text-faint" : "text-ink"}`} data-testid="followers-count" title={f.note ?? undefined}>
          {disabled ? "off" : f.count == null ? "—" : f.approx ? `≈${compact(f.count)}` : num(f.count)}
        </span>
        <span className="text-[0.6875rem] text-muted">{ig ? "followers" : "subscribers"}</span>
      </div>
      <div className="flex items-baseline gap-1.5 text-[0.6875rem]">
        <Delta v={f.delta_24h} />
        <span className="text-faint" title={f.base_at ? `vs the reading at ${f.base_at}` : undefined}>
          {f.delta_24h == null ? "no change measured yet" : toMs(f.base_at) != null && (toMs(f.at) ?? 0) - (toMs(f.base_at) ?? 0) < 20 * 3600_000 ? `since ${ago(f.base_at, now)}` : "since yesterday"}
        </span>
      </div>
      {!disabled && <Trend series={arr(f.series)} label={`${ig ? "followers" : "subscribers"} of ${f.key}, last 7 days`} />}
      <p className="truncate text-[0.65625rem] text-faint" title={f.error ?? f.note ?? undefined}>
        {disabled ? (
          "Instagram disabled this account permanently"
        ) : f.status === "blocked" || f.status === "error" || f.status === "stale" ? (
          (f.error ?? st.text)
        ) : f.at ? (
          <>
            read {ago(f.at, now)}
            {f.videos != null ? ` · ${num(f.videos)} ${ig ? "posts" : "videos"}` : ""} ·{" "}
            <ExtLink href={f.url}>open</ExtLink>
          </>
        ) : (
          st.text
        )}
      </p>
    </li>
  );
}

export function FollowersPanel({ followers, loading }: { followers: Followers | null | undefined; loading: boolean }) {
  const now = useNow(10_000);
  const list = arr(followers?.accounts);
  const yt = list.filter((f) => f.platform === "yt");
  const ig = list.filter((f) => f.platform === "ig");
  const sum = (l: FollowerAccount[]) => (l.some((f) => f.count != null) ? l.reduce((a, f) => a + (f.count ?? 0), 0) : null);
  const dsum = (l: FollowerAccount[]) => (l.some((f) => f.delta_24h != null) ? l.reduce((a, f) => a + (f.delta_24h ?? 0), 0) : null);
  const igBlocked = ig.filter((f) => f.status === "blocked").length;
  return (
    <Panel
      title="Audience"
      meta={loading ? null : `YouTube subscribers and Instagram followers, public pages, read every ${followers?.every_min ?? 30} min${followers?.updated ? ` · last poll ${ago(followers.updated, now)}` : ""}`}
    >
      {loading ? (
        <Skel className="h-[16rem]" />
      ) : list.length === 0 ? (
        <Empty>No audience numbers in this snapshot yet. The exporter reads every channel and page every 30 minutes once it runs the updated code.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {[
            ["YouTube", yt, "subscribers"],
            ["Instagram", ig, "followers"],
          ].map(([name, l, unit]) => (
            <div key={name as string}>
              <h4 className="label mb-2 flex flex-wrap items-baseline gap-x-2">
                {name as string}
                <span className="tnum normal-case tracking-normal text-faint">
                  total {num(sum(l as FollowerAccount[]))} {unit as string} · <Delta v={dsum(l as FollowerAccount[])} /> since yesterday
                </span>
                {name === "Instagram" && igBlocked > 0 && (
                  <span className="normal-case tracking-normal text-warn">
                    · Instagram shows anonymous readers a login wall from this connection: {igBlocked} page{igBlocked === 1 ? "" : "s"} unread (retried every 6 h)
                  </span>
                )}
              </h4>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {(l as FollowerAccount[]).map((f) => (
                  <Card key={`${f.platform}-${f.key}`} f={f} now={now} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------- what the operation costs: everything runs free or local ----------

export function RunningCost({ s, loading }: { s: Snapshot | null; loading: boolean }) {
  const renders = arr(s?.machines?.laptop2?.renders);
  const renderS = renders.reduce((a, r) => a + (r.wall_s ?? 0), 0);
  const qc = s?.holds_breakdown?.visual_qc;
  const ps = s?.platform_stats;
  const rows: { k: string; tier: string; use: React.ReactNode }[] = [
    { k: "Compute", tier: "own laptops, no cloud GPU (no Kaggle/Colab)", use: <>laptop 2 rendered {num(renders.filter((r) => r.stage === "done").length)} Shorts in the last 6 h ({num(Math.round(renderS / 60))} min of render time); transcription on the main laptop&apos;s GPU</> },
    { k: "Uploads", tier: "YouTube Studio + Instagram web, free", use: <>{num(s?.pipeline?.uploaded_yt)} uploaded to Studio · {num(s?.pipeline?.posted_ig)} Reels posted</> },
    { k: "Live link", tier: "Cloudflare quick tunnel, free, no account", use: "only carries data while someone has this page open" },
    { k: "Dashboard", tier: "Vercel Hobby + Blob (free tier)", use: "one snapshot write per 5 min, one history point per hour" },
    { k: "Stats", tier: "public pages, no API keys", use: <>views via yt-dlp every {ps?.every_min ?? 20} min ({num(ps?.totals?.shorts)} Shorts) · audience counts every 30 min</> },
    { k: "Visual QC", tier: "Claude Code plan via the local 9Router", use: <>{num(qc?.checked)} clips checked</> },
    { k: "Claude Code", tier: "subscription (flat)", use: <>{compact(s?.claude?.tokens_today)} tokens today on this machine</> },
  ];
  return (
    <Panel title="Running cost" meta={loading ? null : "every part of the operation runs on free tiers, flat subscriptions or the two laptops"}>
      {loading ? (
        <Skel className="h-[12rem]" />
      ) : (
        <>
          <p className="mb-3 flex items-baseline gap-2">
            <span className="display text-[2.25rem] font-bold leading-none text-ok">$0</span>
            <span className="text-[0.71875rem] text-muted">metered spend (no pay-per-use service in the loop)</span>
          </p>
          <dl className="flex flex-col divide-y divide-rule text-[0.71875rem]">
            {rows.map((r) => (
              <div key={r.k} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 py-1.5">
                <dt className="font-semibold text-ink">{r.k}</dt>
                <dd className="min-w-0">
                  <span className="text-ok">{r.tier}</span>
                  <span className="text-faint"> · {r.use}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[0.65625rem] text-faint">
            Snapshot <Time iso={s?.generated_at} />. Electricity and the subscriptions themselves are not counted.
          </p>
        </>
      )}
    </Panel>
  );
}
