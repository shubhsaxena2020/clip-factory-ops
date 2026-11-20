"use client";

import { useMemo, useState } from "react";
import type { EventItem } from "@/lib/types";
import { arr, bothZones, clock, toMs } from "@/lib/format";
import { Empty, Panel, Skel, useZone } from "./ui";

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

export function Events({ events, loading }: { events: EventItem[] | null | undefined; loading: boolean }) {
  const { zone } = useZone();
  const list = useMemo(() => arr(events), [events]);
  const [filter, setFilter] = useState<string>("all");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.kind ?? "other", (m.get(e.kind ?? "other") ?? 0) + 1);
    return m;
  }, [list]);
  const kinds = [...counts.keys()].sort();
  const shown = filter === "all" ? list : list.filter((e) => (e.kind ?? "other") === filter);

  return (
    <Panel title="Event log" meta={loading ? null : `${list.length} events, newest first`} bodyClass="p-0">
      <div role="group" aria-label="Filter events by kind" className="scroll-thin flex gap-1 overflow-x-auto border-b border-rule px-3 py-2">
        {["all", ...kinds].map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`whitespace-nowrap rounded-[2px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
              filter === k ? "bg-sodium text-[#1a0d04]" : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {k} <span className="tnum opacity-70">{k === "all" ? list.length : counts.get(k)}</span>
          </button>
        ))}
      </div>
      <div
        className="scroll-thin max-h-[420px] min-h-[160px] overflow-y-auto bg-[#0a0807] px-3 py-2 font-mono text-[11.5px] leading-[1.65]"
        role="log"
        aria-live="off"
        tabIndex={0}
      >
        {loading ? (
          <div className="flex flex-col gap-2 pt-1">
            {Array.from({ length: 10 }, (_, i) => (
              <Skel key={i} className="h-3.5" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="pt-2">
            <Empty>
              {list.length === 0
                ? "No events yet. Uploads, posts, failures and discoveries stream in here."
                : "Nothing of this kind in the latest events."}
            </Empty>
          </div>
        ) : (
          <ol>
            {shown.map((e, i) => {
              const ms = toMs(e.at);
              return (
                <li
                  key={`${e.at}-${i}`}
                  className="grid grid-cols-[64px_64px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[64px_70px_120px_minmax(0,1fr)]"
                >
                  <time className="tnum text-faint" dateTime={e.at ?? undefined} title={bothZones(e.at)}>
                    {ms == null ? "--:--:--" : clock(ms, zone)}
                  </time>
                  <span className={`truncate font-semibold uppercase ${KIND_STYLE[e.kind ?? ""] ?? "text-muted"}`}>{e.kind ?? "—"}</span>
                  <span className="hidden truncate text-faint sm:block" title={e.source ?? undefined}>
                    {e.source ?? "—"}
                  </span>
                  <span className="break-words text-ink/90">{e.text ?? ""}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}
