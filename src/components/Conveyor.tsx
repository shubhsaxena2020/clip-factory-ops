"use client";

import type { Account, Pipeline } from "@/lib/types";
import { arr, num } from "@/lib/format";
import { Lamp, Skel } from "./ui";

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

/** The production line: one station per pipeline stage, parcels riding the belt underneath. */
export function Conveyor({
  p,
  accounts,
  loading,
}: {
  p: Pipeline | null | undefined;
  accounts: Account[] | null | undefined;
  loading: boolean;
}) {
  const pp = p ?? {};
  const restyleTotal = (n(pp.restyled) ?? 0) + (n(pp.rerender_pending) ?? 0);
  const restylePct = restyleTotal ? Math.round(((n(pp.restyled) ?? 0) / restyleTotal) * 100) : null;
  const accs = arr(accounts);
  const ytToday = accs.filter((a) => a.platform === "youtube").reduce((s, a) => s + (a.uploads_today ?? 0), 0);
  const igToday = accs.filter((a) => a.platform === "instagram").reduce((s, a) => s + (a.uploads_today ?? 0), 0);

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
    { key: "blocks", label: "Blocks pending", value: pp.blocks_pending, sub: "waiting for the director" },
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
    { key: "scheduled", label: "Scheduled", value: pp.scheduled_yt, sub: "booked on YouTube" },
  ];

  return (
    <section aria-label="Production line" className="panel bracket overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-rule px-4 pb-3 pt-4 sm:px-5">
        <div>
          <h1 className="display text-[30px] font-extrabold uppercase sm:text-[38px]">Production line</h1>
          <p className="mt-1 text-[12px] text-muted">From a live stream to a published Short, counted at every station.</p>
        </div>
        <div className="flex gap-6 text-[12px]">
          <div>
            <div className="label">YouTube today</div>
            <div className="tnum mt-0.5 text-[18px] font-semibold text-ink">{loading ? "—" : ytToday}</div>
          </div>
          <div>
            <div className="label">Reels today</div>
            <div className="tnum mt-0.5 text-[18px] font-semibold text-ink">{loading ? "—" : igToday}</div>
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
                <span className="tnum text-[10px] font-semibold text-sodium">{String(i + 1).padStart(2, "0")}</span>
                <span className="label">{s.label}</span>
              </div>
              <div className="display tnum mt-3 text-[46px] font-bold text-ink sm:text-[54px]">
                {loading ? <Skel className="h-[44px] w-[96px]" /> : num(s.value)}
              </div>
              <div className="mt-2 min-h-[18px] text-[11.5px] text-muted">{loading ? <Skel className="h-3 w-24" /> : s.sub}</div>
            </li>
          ))}
          <li className="relative col-span-2 grid grid-cols-2 sm:col-span-4 xl:col-span-1 xl:grid-cols-1">
            <OutStation index={8} label="Published" platform="YouTube" value={pp.uploaded_yt} loading={loading} />
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
        <span className="tnum text-[10px] font-semibold text-sodium">{String(index).padStart(2, "0")}</span>
        <span className="label !text-sodium">{label}</span>
        <span className="text-[10.5px] text-muted">{platform}</span>
      </div>
      <div className="display tnum mt-1 text-[40px] font-bold text-sodium">
        {loading ? <Skel className="h-[36px] w-[72px]" /> : num(value)}
      </div>
    </div>
  );
}

/** The belt along the bottom edge. Dashes and parcels move left to right; static when motion is reduced. */
function Belt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 xl:right-[calc(100%/8.25*1.25)]">
      <svg className="absolute inset-x-0 bottom-[9px] h-[6px] w-full" preserveAspectRatio="none" viewBox="0 0 100 6">
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
        <div key={d} className="parcel-track absolute inset-x-0 bottom-[12px] h-[7px]" style={{ animationDelay: `-${d}s` }}>
          <span className="block h-[7px] w-[11px] rounded-[1px] bg-sodium shadow-[0_0_10px_var(--color-sodium)]" />
        </div>
      ))}
    </div>
  );
}
