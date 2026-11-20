"use client";

import { useState } from "react";
import type { Pipeline, Stream } from "@/lib/types";
import { ago, arr, num } from "@/lib/format";
import { Empty, ExtLink, Lamp, Panel, PlatformDot, Skel, Thumb, useNow } from "./ui";

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

  return (
    <Panel
      title="Tracked streams"
      meta={loading ? null : `${all.length} in this snapshot, ${live} live, ${num(pipeline?.streams_tracked)} tracked in total`}
      right={
        <div role="group" aria-label="Filter by platform" className="flex gap-1">
          {(["all", "youtube", "twitch"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              onClick={() => setPlatform(p)}
              className={`rounded-[2px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
                platform === p ? "bg-sodium text-[#1a0d04]" : "text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skel key={i} className="h-[250px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No streams tracked{platform !== "all" ? ` on ${platform}` : ""}. Discovery adds GTA 6 streams here as it finds them.</Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {list.map((s) => {
            const liveNow = isLive(s);
            const tw = (s.platform ?? "").toLowerCase() === "twitch";
            const clips = s.clips ?? 0;
            return (
              <li key={s.id} className={`flex min-w-0 flex-col overflow-hidden rounded-[3px] border bg-raised/50 ${liveNow ? "border-live/60" : "border-rule"}`}>
                <div className="relative">
                  {tw && !s.thumb ? (
                    <div className="grid aspect-video place-items-center bg-[linear-gradient(135deg,#2a1a44,#15120f)]">
                      <span className="display text-[34px] font-bold uppercase text-tw">{s.creator ?? "Twitch"}</span>
                    </div>
                  ) : (
                    <Thumb src={s.thumb} alt="" className="w-full" />
                  )}
                  {liveNow && (
                    <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-[2px] bg-live px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                      <span className="lamp-pulse size-[6px] rounded-full bg-white" />
                      Live
                    </span>
                  )}
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-[2px] bg-bg/85 px-1.5 text-[10px] font-semibold uppercase text-ink">
                    <PlatformDot platform={s.platform} />
                    {s.audience ?? ""}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">{s.creator ?? "unknown creator"}</div>
                    <ExtLink href={s.url} className="line-clamp-2 text-[12px] text-muted">
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
                        <dt className="label !text-[9.5px]">{k as string}</dt>
                        <dd className="display tnum text-[24px] font-bold">{num(v as number | null)}</dd>
                      </div>
                    ))}
                  </dl>
                  {clips > 0 && (
                    <div className="flex h-[4px] overflow-hidden rounded-[1px] bg-rule-strong/70" aria-hidden>
                      <span className="bg-sodium" style={{ width: `${((s.uploaded ?? 0) / clips) * 100}%` }} />
                      <span className="bg-sodium/40" style={{ width: `${(Math.max(0, (s.ready ?? 0) - (s.uploaded ?? 0)) / clips) * 100}%` }} />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10.5px] text-faint">
                    {liveNow && <Lamp tone="live" />}
                    <span>{(s.live_status ?? "unknown").replace(/_/g, " ")}</span>
                    {s.started_at && <span>· started {ago(s.started_at, now)}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
