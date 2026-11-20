"use client";

import type { Job } from "@/lib/types";
import { ago, arr } from "@/lib/format";
import { Empty, Lamp, Panel, Pill, Skel, useNow } from "./ui";

const GROUP_ORDER = ["produce", "publish", "support", "research"];
const GROUP_NOTE: Record<string, string> = {
  produce: "cut, restyle, write",
  publish: "uploaders and posters",
  support: "watchers and plumbing",
  research: "discovery and analytics",
};

export function Jobs({ jobs, loading }: { jobs: Job[] | null | undefined; loading: boolean }) {
  const now = useNow(15_000);
  const list = arr(jobs);
  const dead = list.filter((j) => j.running === false).length;
  const groups = new Map<string, Job[]>();
  for (const j of list) {
    const g = (j.group ?? "other").toLowerCase();
    groups.set(g, [...(groups.get(g) ?? []), j]);
  }
  const keys = [...GROUP_ORDER.filter((g) => groups.has(g)), ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g))];

  return (
    <Panel
      title="Jobs"
      meta={loading ? null : `${list.length - dead} running, ${dead} stopped`}
      right={dead > 0 ? <Pill tone="err">{dead} down</Pill> : undefined}
    >
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} className="h-[220px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No processes reported. When start_gta6.ps1 is running, each pipeline process shows up here with its last log line.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {keys.map((g) => (
            <div key={g} className="min-w-0">
              <h3 className="mb-2 flex items-baseline gap-2 border-b border-rule pb-1.5">
                <span className="label !text-sodium">{g}</span>
                <span className="text-[11px] text-faint">{GROUP_NOTE[g] ?? ""}</span>
              </h3>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2">
                {groups.get(g)!.map((j) => (
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
  const dead = j.running === false;
  const errs = j.errors_1h ?? 0;
  return (
    <li className={`rounded-[3px] border p-2.5 ${dead ? "dead-glow border-err/50 bg-err/[0.06]" : "border-rule bg-raised/50"}`}>
      <div className="flex items-center gap-2">
        <Lamp tone={dead ? "err" : "ok"} pulse={!dead} label={dead ? "stopped" : "running"} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink" title={j.key}>
          {j.name ?? j.key}
        </span>
        {dead ? (
          <Pill tone="err">dead</Pill>
        ) : (
          <span className="tnum text-[11px] text-muted" title="CPU %">
            {j.cpu_pct == null ? "—" : `${j.cpu_pct.toFixed(1)}%`}
          </span>
        )}
      </div>
      <p
        className={`mt-1.5 line-clamp-2 break-all font-mono text-[11px] leading-snug ${dead ? "text-err/90" : "text-muted"}`}
        title={j.last_line ?? undefined}
      >
        {j.last_line ?? "no output yet"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-faint">
        <span>{j.last_line_at ? ago(j.last_line_at, now) : "—"}</span>
        {j.pid != null && <span>pid {j.pid}</span>}
        {errs > 0 && (
          <span className="text-warn">
            {errs} error{errs === 1 ? "" : "s"} in 1h
          </span>
        )}
      </div>
    </li>
  );
}
