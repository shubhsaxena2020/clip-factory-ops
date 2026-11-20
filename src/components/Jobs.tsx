"use client";

import type { Job } from "@/lib/types";
import { ago, arr } from "@/lib/format";
import { Empty, Lamp, Panel, Pill, Skel, useNow, type Tone } from "./ui";

const GROUP_ORDER = ["produce", "publish", "support", "research"];
const GROUP_NOTE: Record<string, string> = {
  produce: "cut, restyle, write",
  publish: "uploaders, posters, checks",
  support: "servers and plumbing",
  research: "discovery",
};

function jobState(j: Job): string {
  if (j.running) return "running";
  return j.state && j.state !== "running" ? j.state : "stopped";
}

const STATE_TONE: Record<string, Tone> = { running: "ok", finished: "faint", off: "faint", stopped: "err" };

export function Jobs({ jobs, loading }: { jobs: Job[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const list = arr(jobs);
  const stopped = list.filter((j) => jobState(j) === "stopped").length;
  const running = list.filter((j) => j.running).length;
  const groups = new Map<string, Job[]>();
  for (const j of list) {
    const g = (j.group ?? "other").toLowerCase();
    groups.set(g, [...(groups.get(g) ?? []), j]);
  }
  const keys = [...GROUP_ORDER.filter((g) => groups.has(g)), ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g))];
  const order = (j: Job) => (jobState(j) === "stopped" ? 0 : (j.errors_1h ?? 0) > 0 ? 1 : jobState(j) === "running" ? 2 : 3);

  return (
    <Panel
      title="Jobs, main laptop"
      meta={loading ? null : `${running} running · problems first in each group · CPU is each job's process tree, share of the whole machine`}
      right={stopped > 0 ? <Pill tone="err">{stopped} stopped</Pill> : undefined}
    >
      {loading ? (
        <Skel className="h-[16.25rem]" />
      ) : list.length === 0 ? (
        <Empty>No processes reported. When start_gta6.ps1 is running, each pipeline process shows up here with its last log line.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {keys.map((g) => (
            <div key={g} className="min-w-0">
              <h3 className="mb-2 flex items-baseline gap-2 border-b border-rule pb-1.5">
                <span className="label !text-sodium">{g}</span>
                <span className="text-[0.6875rem] text-faint">{GROUP_NOTE[g] ?? ""}</span>
              </h3>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))] gap-2">
                {[...groups.get(g)!]
                  .sort((a, b) => order(a) - order(b) || (a.name ?? a.key).localeCompare(b.name ?? b.key))
                  .map((j) => (
                    <JobRow key={j.key} j={j} now={now} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function JobRow({ j, now }: { j: Job; now: number }) {
  const st = jobState(j);
  const dead = st === "stopped";
  const errs = j.errors_1h ?? 0;
  return (
    <li className={`rounded-[3px] border p-2.5 ${dead ? "dead-glow border-err/50 bg-err/[0.06]" : "border-rule bg-raised/50"}`}>
      <div className="flex items-center gap-2">
        <Lamp tone={STATE_TONE[st] ?? "faint"} pulse={st === "running"} label={st} />
        <span className="min-w-0 flex-1 truncate text-[0.78125rem] font-semibold text-ink" title={j.key}>
          {j.name ?? j.key}
        </span>
        {st === "running" ? (
          <span className="tnum text-[0.6875rem] text-muted" title="CPU % of the whole machine (process tree)">
            {j.cpu_pct == null ? "—" : `${j.cpu_pct.toFixed(1)}%`}
          </span>
        ) : (
          <Pill tone={STATE_TONE[st] ?? "faint"}>{st}</Pill>
        )}
      </div>
      <p
        key={j.last_line ?? ""}
        className={`line-fresh mt-1.5 line-clamp-2 break-all font-mono text-[0.6875rem] leading-snug ${dead ? "text-err/90" : "text-muted"}`}
        title={j.last_line ?? undefined}
      >
        {j.last_line ?? "no output yet"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.65625rem] text-faint">
        <span className="tnum">{j.last_line_at ? ago(j.last_line_at, now) : "—"}</span>
        {j.pid != null && <span>pid {j.pid}</span>}
        {errs > 0 && (
          <span className="text-warn" title="error/fail lines in the last hour (upload-limit retries not counted)">
            {errs} error{errs === 1 ? "" : "s"} in 1 h
          </span>
        )}
      </div>
    </li>
  );
}
