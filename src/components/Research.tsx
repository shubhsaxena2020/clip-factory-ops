"use client";

import { useState } from "react";
import type { Discovery as DiscoveryT, DiscoveryEntry, ResearchItem } from "@/lib/types";
import { ago, arr, compact, toMs } from "@/lib/format";
import { Empty, ExtLink, Panel, Pill, Skel, Time, useNow } from "./ui";

export function Research({ research, loading }: { research: ResearchItem[] | null | undefined; loading: boolean }) {
  const now = useNow(60_000);
  const list = [...arr(research)].sort((a, b) => (toMs(b.updated) ?? 0) - (toMs(a.updated) ?? 0));
  return (
    <Panel title="Research" meta={loading ? null : `${list.length} folders, newest first`}>
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[180px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No research folders yet. Each folder under research/ shows here with the start of its summary.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <ResearchCard key={r.name} r={r} now={now} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ResearchCard({ r, now }: { r: ResearchItem; now: number }) {
  const [open, setOpen] = useState(false);
  const long = (r.summary?.length ?? 0) > 280;
  const [topic, date] = splitName(r.name);
  const summary = r.summary ? cleanMarkdown(r.summary) : null;
  return (
    <li className="flex min-w-0 flex-col rounded-[3px] border border-rule bg-raised/50 p-3">
      <div className="flex items-baseline gap-2">
        <h3 className="display min-w-0 flex-1 truncate text-[22px] font-bold uppercase" title={r.name}>
          {topic}
        </h3>
        {date && <span className="tnum text-[11px] text-faint">{date}</span>}
      </div>
      <div className="mt-1 flex gap-3 text-[10.5px] text-faint">
        <span>{r.files ?? "—"} files</span>
        <span>updated {ago(r.updated, now)}</span>
      </div>
      {summary ? (
        <>
          <p className={`mt-2 whitespace-pre-line text-[12px] leading-relaxed text-muted ${open ? "" : "line-clamp-6"}`}>{summary}</p>
          {long && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="mt-1 self-start text-[11px] text-sodium underline-offset-2 hover:underline"
            >
              {open ? "Show less" : "Show more"}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-[12px] text-faint">No SUMMARY, FINDINGS or README in this folder yet.</p>
      )}
    </li>
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
  return (
    <Panel
      title="Discovery"
      meta={loading ? null : discovery?.last_run ? <>last pass <Time iso={String(discovery.last_run)} /></> : "no pass recorded"}
    >
      {loading ? (
        <Skel className="h-[200px]" />
      ) : !discovery ? (
        <Empty>Discovery has not reported a run yet.</Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <h3 className="label mb-2">Added in the last pass</h3>
            {added.length === 0 ? (
              <Empty>Nothing new was added on the last pass.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-rule">
                {added.map((d, i) => (
                  <Entry key={`${d.id}-${i}`} d={d} metric={d.score != null ? `score ${compact(d.score)}` : null} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="label mb-2">Top candidates</h3>
            {top.length === 0 ? (
              <Empty>No candidates ranked.</Empty>
            ) : (
              <ol className="flex flex-col divide-y divide-rule">
                {top.map((d, i) => (
                  <Entry
                    key={`${d.id}-${i}`}
                    d={d}
                    rank={i + 1}
                    metric={(d.watching ?? 0) > 0 ? `${compact(d.watching)} watching` : d.views != null ? `${compact(d.views)} views` : null}
                  />
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Entry({ d, metric, rank }: { d: DiscoveryEntry; metric: string | null; rank?: number }) {
  const url = /^[\w-]{11}$/.test(d.id) ? `https://www.youtube.com/watch?v=${d.id}` : null;
  return (
    <li className="flex items-start gap-3 py-2">
      {rank != null && <span className="tnum w-5 pt-0.5 text-[11px] text-faint">{rank}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink">{d.channel ?? "unknown channel"}</span>
          {d.kind && <Pill tone={d.kind === "live" ? "live" : "faint"}>{d.kind}</Pill>}
        </div>
        <ExtLink href={url} className="line-clamp-1 text-[12px] text-muted">
          {d.title ?? d.id}
        </ExtLink>
      </div>
      {metric && <span className="tnum whitespace-nowrap pt-0.5 text-[12px] text-sodium">{metric}</span>}
    </li>
  );
}
