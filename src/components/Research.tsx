"use client";

import { useState } from "react";
import type { Discovery as DiscoveryT, DiscoveryEntry, ResearchItem } from "@/lib/types";
import { ago, arr, compact, toMs } from "@/lib/format";
import { Empty, ExtLink, Panel, Pill, Skel, Time, useNow, useShowMore } from "./ui";

export function Research({ research, loading }: { research: ResearchItem[] | null | undefined; loading: boolean }) {
  const now = useNow(30_000);
  const list = [...arr(research)].sort((a, b) => (toMs(b.updated) ?? 0) - (toMs(a.updated) ?? 0));
  const { shown, toggle } = useShowMore(list, 10);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Research" meta={loading ? null : `${list.length} folders, newest change first · click to read`} bodyClass="p-0">
      {loading ? (
        <div className="p-4">
          <Skel className="h-[16.25rem]" />
        </div>
      ) : list.length === 0 ? (
        <div className="p-4">
          <Empty>No research folders yet. Each folder under research/ shows here with the start of its summary.</Empty>
        </div>
      ) : (
        <div className="px-3 pb-3">
          <ul className="divide-y divide-rule">
            {shown.map((r) => {
              const [topic, date] = splitName(r.name);
              const isOpen = open === r.name;
              const fresh = (toMs(r.updated) ?? 0) > now - 3600_000;
              return (
                <li key={r.name}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)} className="w-full py-2 text-left">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[0.6875rem] text-sodium">{isOpen ? "▾" : "▸"}</span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold capitalize text-ink" title={r.name}>
                        {topic}
                      </span>
                      {fresh && <Pill tone="ok">active</Pill>}
                      {date && <span className="tnum text-[0.6875rem] text-faint">{date}</span>}
                    </div>
                    <div className="ml-4 mt-0.5 flex gap-3 text-[0.65625rem] text-faint">
                      <span>{r.files ?? "—"} files</span>
                      <span>updated {ago(r.updated, now)}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <p className="slide-in mb-2 ml-4 whitespace-pre-line text-[0.75rem] leading-relaxed text-muted">
                      {r.summary ? cleanMarkdown(r.summary) : "No SUMMARY, FINDINGS or README in this folder yet."}
                    </p>
                  )}
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

/** Summaries are the first ~600 chars of a Markdown file; drop the syntax so they read as prose. */
function cleanMarkdown(md: string): string {
  return md
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+-\s+/g, "\n- ")
    .trim();
}

function splitName(name: string): [string, string | null] {
  const m = name.match(/^(.*?)_(\d{4}-\d{2}-\d{2})$/);
  return m ? [m[1].replace(/[_-]+/g, " "), m[2]] : [name.replace(/[_-]+/g, " "), null];
}

export function Discovery({ discovery, loading }: { discovery: DiscoveryT | null | undefined; loading: boolean }) {
  const added = arr(discovery?.added);
  const top = arr(discovery?.top);
  const { shown, toggle } = useShowMore(top, 6);
  return (
    <Panel
      title="Discovery"
      meta={loading ? null : discovery?.last_run ? <>last pass <Time iso={String(discovery.last_run)} /></> : "no pass recorded"}
    >
      {loading ? (
        <Skel className="h-[12.5rem]" />
      ) : !discovery ? (
        <Empty>Discovery has not reported a run yet.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="label mb-1">Added in the last pass</h3>
            {added.length === 0 ? (
              <p className="text-[0.75rem] text-faint">Nothing new was added on the last pass.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-rule">
                {added.map((d, i) => (
                  <Entry key={`${d.id}-${i}`} d={d} metric={d.score != null ? `score ${compact(d.score)}` : null} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="label mb-1">Top candidates (viewers now, else views)</h3>
            {top.length === 0 ? (
              <p className="text-[0.75rem] text-faint">No candidates ranked.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-rule">
                {shown.map((d, i) => (
                  <Entry
                    key={`${d.id}-${i}`}
                    d={d}
                    rank={i + 1}
                    metric={(d.watching ?? 0) > 0 ? `${compact(d.watching)} watching` : d.views != null ? `${compact(d.views)} views` : null}
                  />
                ))}
              </ol>
            )}
            {toggle}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Entry({ d, metric, rank }: { d: DiscoveryEntry; metric: string | null; rank?: number }) {
  const url = /^[\w-]{11}$/.test(d.id) ? `https://www.youtube.com/watch?v=${d.id}` : null;
  return (
    <li className="flex items-start gap-3 py-1.5">
      {rank != null && <span className="tnum w-5 pt-0.5 text-[0.6875rem] text-faint">{rank}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.78125rem] font-semibold text-ink">{d.channel ?? "unknown channel"}</span>
          {d.kind && <Pill tone={d.kind === "live" ? "live" : "faint"}>{d.kind}</Pill>}
        </div>
        <ExtLink href={url} className="line-clamp-1 text-[0.75rem] text-muted">
          {d.title ?? d.id}
        </ExtLink>
      </div>
      {metric && <span className="tnum whitespace-nowrap pt-0.5 text-[0.75rem] text-sodium">{metric}</span>}
    </li>
  );
}
