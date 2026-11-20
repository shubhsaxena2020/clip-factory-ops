"use client";

import type { Agent } from "@/lib/types";
import { ago, arr } from "@/lib/format";
import { Empty, Lamp, Panel, Pill, Skel, useNow, type Tone } from "./ui";

const KIND_LABEL: Record<string, string> = {
  "claude-subagent": "Claude",
  codex: "Codex",
  opencode: "OpenCode",
  hermes: "Hermes",
  antigravity: "Antigravity",
};

function tone(s?: string | null): Tone {
  return s === "running" ? "ok" : s === "failed" ? "err" : s === "done" ? "faint" : "warn";
}

export function Agents({ agents, loading }: { agents: Agent[] | null | undefined; loading: boolean }) {
  const now = useNow(30_000);
  const list = [...arr(agents)].sort((a, b) => (a.status === "running" ? 0 : 1) - (b.status === "running" ? 0 : 1));
  const running = list.filter((a) => a.status === "running").length;
  return (
    <Panel title="AI agents" meta={loading ? null : `${running} working, ${list.length - running} finished`}>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} className="h-[74px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No agents are registered. Subagents and delegate CLIs add themselves to state/agents.json while they work.</Empty>
      ) : (
        <ul className="scroll-thin flex max-h-[460px] flex-col gap-2 overflow-y-auto pr-1">
          {list.map((a, i) => {
            const t = tone(a.status);
            return (
              <li key={`${a.name}-${i}`} className="rounded-[3px] border border-rule bg-raised/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-[2px] border border-sodium/40 px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sodium">
                    {KIND_LABEL[a.kind ?? ""] ?? a.kind ?? "agent"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{a.name}</span>
                  <Pill tone={t}>
                    <Lamp tone={t} pulse={a.status === "running"} />
                    {a.status ?? "unknown"}
                  </Pill>
                </div>
                {a.task && <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted">{a.task}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-faint">
                  <span>started {ago(a.started, now)}</span>
                  <span>updated {ago(a.updated, now)}</span>
                  {a.output && (
                    <span className="min-w-0 max-w-full truncate" title={a.output}>
                      {a.output}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
