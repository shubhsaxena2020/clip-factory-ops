"use client";

import { useState } from "react";
import type { Pipeline, Stream } from "@/lib/types";
import { ago, arr, num } from "@/lib/format";
import { Chips, Empty, ExtLink, Lamp, Panel, PlatformDot, Thumb, Skel, useNow, useShowMore } from "./ui";

const isLive = (s: Stream) => (s.live_status ?? "").toLowerCase() === "is_live";

export function Streams({
  streams,
  pipeline,
  loading,
}: {
  streams: Stream[] | null | undefined;
  pipeline: Pipeline | null | undefined;
  loading: boolean;
}) {
  const now = useNow(60_000);
  const [platform, setPlatform] = useState<"all" | "youtube" | "twitch">("all");
  const all = arr(streams);
  const list = [...all]
    .filter((s) => platform === "all" || (s.platform ?? "").toLowerCase() === platform)
    .sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.clips ?? 0) - (a.clips ?? 0));
  const live = all.filter(isLive).length;
  const { shown, toggle } = useShowMore(list, 12);

  return (
    <Panel
      title="Tracked streams"
      meta={loading ? null : `live first, then most clips · ${live} live of ${num(pipeline?.streams_tracked ?? all.length)}`}
      right={<Chips value={platform} options={["all", "youtube", "twitch"] as const} onChange={setPlatform} label="Filter by platform" />}
      bodyClass="p-0"
    >
      {loading ? (
        <div className="p-4">
          <Skel className="h-[20rem]" />
        </div>
      ) : list.length === 0 ? (
        <div className="p-4">
          <Empty>No streams tracked{platform !== "all" ? ` on ${platform}` : ""}. Discovery adds GTA 6 streams here as it finds them.</Empty>
        </div>
      ) : (
        <div className="p-3">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-2">
          {shown.map((s) => {
            const liveNow = isLive(s);
            const tw = (s.platform ?? "").toLowerCase() === "twitch";
            const clips = s.clips ?? 0;
            return (
              <li key={s.id} className={`flex min-w-0 flex-col overflow-hidden rounded-[3px] border bg-raised/50 ${liveNow ? "border-live/60" : "border-rule"}`}>
                <div className="relative">
                  {tw && !s.thumb ? (
                    <div className="grid aspect-video place-items-center bg-[linear-gradient(135deg,#2a1a44,#15120f)]">
                      <span className="display text-[2.125rem] font-bold uppercase text-tw">{s.creator ?? "Twitch"}</span>
                    </div>
                  ) : (
                    <Thumb src={s.thumb} alt="" className="w-full" />
                  )}
                  {liveNow && (
                    <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-[2px] bg-live px-1.5 py-[1px] text-[0.625rem] font-bold uppercase tracking-[0.12em] text-white">
                      <span className="lamp-pulse size-[0.375rem] rounded-full bg-white" />
                      Live
                    </span>
                  )}
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-[2px] bg-bg/85 px-1.5 text-[0.625rem] font-semibold uppercase text-ink">
                    <PlatformDot platform={s.platform} />
                    {s.audience ?? ""}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <div className="text-[0.78125rem] font-semibold text-ink">{s.creator ?? "unknown creator"}</div>
                    <ExtLink href={s.url} className="line-clamp-2 text-[0.75rem] text-muted">
                      {s.title ?? s.id}
                    </ExtLink>
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-rule pt-2 text-center">
                    {[
                      ["clips", s.clips],
                      ["ready", s.ready],
                      ["uploaded", s.uploaded],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="label !text-[0.59375rem]">{k as string}</dt>
                        <dd className="display tnum text-[1.5rem] font-bold">{num(v as number | null)}</dd>
                      </div>
                    ))}
                  </dl>
                  {clips > 0 && (
                    <div className="flex h-[0.25rem] overflow-hidden rounded-[1px] bg-rule-strong/70" aria-hidden>
                      <span className="bg-sodium" style={{ width: `${((s.uploaded ?? 0) / clips) * 100}%` }} />
                      <span className="bg-sodium/40" style={{ width: `${(Math.max(0, (s.ready ?? 0) - (s.uploaded ?? 0)) / clips) * 100}%` }} />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[0.65625rem] text-faint">
                    {liveNow && <Lamp tone="live" />}
                    <span>{(s.live_status ?? "unknown").replace(/_/g, " ")}</span>
                    {s.started_at && <span>· started {ago(s.started_at, now)}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {toggle}
        </div>
      )}
    </Panel>
  );
}
