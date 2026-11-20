"use client";

import type { Pipeline } from "@/lib/types";
import { num } from "@/lib/format";
import { Lamp, Num, Skel } from "./ui";

type Station = {
  key: string;
  label: string;
  value: number | null | undefined;
  sub: React.ReactNode;
  accent?: boolean;
};

function n(v: number | null | undefined) {
  return v == null || !Number.isFinite(v) ? null : v;
}

/** The clip run's CURRENT round (newest live_MMDD_HHMM.log): blocks left, counting down as blocks finish. */
function roundStation(pp: Pipeline): Station {
  const r = pp.round;
  if (!r) return { key: "blocks", label: "Blocks left", value: null, sub: "no clip-run log yet" };
  const title = `round ${r.n ?? "—"} of the clip run started ${r.log ?? ""}: ${r.queued ?? "—"} blocks queued at its start, ${r.done ?? 0} done, ${r.in_progress ?? 0} in progress, ${r.failed ?? 0} failed`;
  if (r.n == null) return { key: "blocks", label: "Blocks left", value: null, sub: <span title={title}>clip run starting: reading streams</span> };
  if (r.state === "waiting")
    return { key: "blocks", label: "Blocks left", value: 0, sub: <span title={title}>round {r.n}: nothing ready, waiting for new stream time</span> };
  if (r.state === "scanning")
    return { key: "blocks", label: "Blocks left", value: 0, sub: <span title={title}>round {r.n} done: reading streams for round {r.n + 1}</span> };
  return {
    key: "blocks",
    label: "Blocks left",
    value: r.remaining,
    sub: (
      <span title={title} data-testid="round-sub">
        round {r.n}: {num(r.done)} of {num(r.queued)} done{(r.in_progress ?? 0) > 0 ? ` · ${r.in_progress} in progress` : ""}
        {(r.failed ?? 0) > 0 ? <span className="text-err"> · {r.failed} failed</span> : null}
      </span>
    ),
  };
}

/** The production line: one station per pipeline stage, parcels riding the belt underneath. */
export function Conveyor({ p, loading }: { p: Pipeline | null | undefined; loading: boolean }) {
  const pp = p ?? {};
  const restyleTotal = (n(pp.restyled) ?? 0) + (n(pp.rerender_pending) ?? 0);
  const restylePct = restyleTotal ? Math.round(((n(pp.restyled) ?? 0) / restyleTotal) * 100) : null;

  const stations: Station[] = [
    {
      key: "streams",
      label: "Streams",
      value: pp.streams_tracked,
      sub: (
        <span className="flex items-center gap-1.5">
          {(pp.streams_live ?? 0) > 0 && <Lamp tone="live" pulse />}
          <span className={(pp.streams_live ?? 0) > 0 ? "text-live" : ""}>{num(pp.streams_live)} live now</span>
        </span>
      ),
    },
    roundStation(pp),
    { key: "clips", label: "Clips cut", value: pp.clips_total, sub: `${num(pp.clips_ready)} ready` },
    {
      key: "restyled",
      label: "Restyled",
      value: pp.restyled,
      sub: (
        <>
          <span className={(pp.rerender_pending ?? 0) > 0 ? "text-warn" : ""}>{num(pp.rerender_pending)} to re-render</span>
          {restylePct != null && <span className="text-faint"> · {restylePct}%</span>}
        </>
      ),
    },
    { key: "seo", label: "SEO v3", value: pp.seo_v3, sub: `${num(pp.reels_built)} reels built` },
    { key: "eligible", label: "Eligible", value: pp.eligible_to_upload, sub: `${num(pp.held)} held back` },
    {
      key: "scheduled",
      label: "Scheduled",
      value: pp.scheduled_yt,
      sub: (
        <span title="YouTube Shorts with a future slot that the Studio audit saw scheduled (any date ahead). Unverified = uploaded, not confirmed either way (future or past slots).">
          all upcoming, Studio-confirmed{(pp.unverified_yt ?? 0) > 0 ? <span className="text-faint"> · {num(pp.unverified_yt)} unverified</span> : null}
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Production line" className="panel bracket overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-rule px-4 pb-3 pt-4 sm:px-5">
        <div>
          <h1 className="display text-[1.875rem] font-extrabold uppercase sm:text-[2.375rem]">Production line</h1>
          <p className="mt-1 text-[0.75rem] text-muted">From a live stream to a published Short, counted at every station.</p>
        </div>
        <div className="flex gap-6 text-[0.75rem]">
          <div title="uploaded to YouTube Studio, any state">
            <div className="label">Uploaded to Studio</div>
            <div className="tnum mt-0.5 text-[1.125rem] font-semibold text-ink">{loading ? "—" : <Num value={pp.uploaded_yt} />}</div>
          </div>
          <div title="YouTube: Studio private/draft/missing or not public after its slot; Instagram: the audit found the reel broken (all time)">
            <div className="label">Problems</div>
            <div className={`tnum mt-0.5 text-[1.125rem] font-semibold ${(pp.problem_yt ?? 0) + (pp.problem_ig ?? 0) > 0 ? "text-err" : "text-ink"}`}>
              {loading ? "—" : <Num value={(pp.problem_yt ?? 0) + (pp.problem_ig ?? 0)} />}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <ol className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.25fr)]">
          {stations.map((s, i) => (
            <li
              key={s.key}
              className={`relative border-b border-r border-rule px-4 pb-9 pt-4 sm:px-5 xl:border-b-0 ${
                i === stations.length - 1 ? "col-span-2 xl:col-span-1" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="tnum text-[0.625rem] font-semibold text-sodium">{String(i + 1).padStart(2, "0")}</span>
                <span className="label">{s.label}</span>
              </div>
              <div className="display tnum mt-3 text-[2.875rem] font-bold text-ink sm:text-[3.375rem]">
                {loading ? <Skel className="h-[2.75rem] w-[6rem]" /> : <Num value={s.value} />}
              </div>
              <div className="mt-2 min-h-[1.125rem] text-[0.71875rem] text-muted">{loading ? <Skel className="h-3 w-24" /> : s.sub}</div>
            </li>
          ))}
          <li className="relative col-span-2 grid grid-cols-2 sm:col-span-4 xl:col-span-1 xl:grid-cols-1">
            <OutStation index={8} label="Published" platform="YouTube, public" value={pp.published_yt ?? null} loading={loading} />
            <OutStation index={9} label="Posted" platform="Instagram" value={pp.posted_ig} loading={loading} border />
          </li>
        </ol>
        <Belt />
      </div>
    </section>
  );
}

function OutStation({
  index,
  label,
  platform,
  value,
  loading,
  border,
}: {
  index: number;
  label: string;
  platform: string;
  value: number | null | undefined;
  loading: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`bg-sodium/[0.07] px-4 py-3 sm:px-5 ${border ? "border-l border-rule xl:border-l-0 xl:border-t" : ""} pb-9 xl:pb-3`}
    >
      <div className="flex items-center gap-2">
        <span className="tnum text-[0.625rem] font-semibold text-sodium">{String(index).padStart(2, "0")}</span>
        <span className="label !text-sodium">{label}</span>
        <span className="text-[0.65625rem] text-muted">{platform}</span>
      </div>
      <div className="display tnum mt-1 text-[2.5rem] font-bold text-sodium">
        {loading ? <Skel className="h-[2.25rem] w-[4.5rem]" /> : <Num value={value} />}
      </div>
    </div>
  );
}

/** The belt along the bottom edge. Dashes and parcels move left to right; static when motion is reduced. */
function Belt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 xl:right-[calc(100%/8.25*1.25)]">
      <svg className="absolute inset-x-0 bottom-[0.5625rem] h-[0.375rem] w-full" preserveAspectRatio="none" viewBox="0 0 100 6">
        <line x1="0" y1="1" x2="100" y2="1" stroke="var(--color-rule-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line
          className="belt-move"
          x1="0"
          y1="4"
          x2="100"
          y2="4"
          stroke="var(--color-sodium-deep)"
          strokeWidth="2"
          strokeDasharray="6 6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {[0, 1.5, 3, 4.5].map((d) => (
        <div key={d} className="parcel-track absolute inset-x-0 bottom-[0.75rem] h-[0.4375rem]" style={{ animationDelay: `-${d}s` }}>
          <span className="block h-[0.4375rem] w-[0.6875rem] rounded-[1px] bg-sodium shadow-[0_0_10px_var(--color-sodium)]" />
        </div>
      ))}
    </div>
  );
}
