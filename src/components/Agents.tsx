"use client";

import { useMemo, useState } from "react";
import type { Agent } from "@/lib/types";
import { ago, arr, dur, toMs } from "@/lib/format";
import { Chips, Empty, Lamp, Panel, Pill, Skel, useNow, useShowMore, type Tone } from "./ui";

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

/** running = time since start; finished = start to last update */
function runTime(a: Agent, now: number): string {
  const s = toMs(a.started);
  if (s == null) return "—";
  const e = a.status === "running" ? now : (toMs(a.updated) ?? now);
  return dur(Math.max(0, e - s));
}

function sortAgents(list: Agent[]) {
  const r = (a: Agent) => (a.status === "running" ? 0 : a.status === "failed" ? 1 : 2);
  return [...list].sort((a, b) => r(a) - r(b) || (toMs(b.updated ?? b.started) ?? 0) - (toMs(a.updated ?? a.started) ?? 0));
}

/** Overview: the agents working right now, with their running time. */
export function AgentsNow({ agents, loading, onMore }: { agents: Agent[] | null | undefined; loading: boolean; onMore: () => void }) {
  const now = useNow(1000);
  const all = arr(agents);
  const running = sortAgents(all).filter((a) => a.status === "running");
  return (
    <Panel
      title="AI agents at work"
      meta={loading ? null : `${running.length} running · ${all.length - running.length} finished`}
      right={
        <button type="button" onClick={onMore} className="text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">
          All agents
        </button>
      }
      bodyClass="px-4 py-2"
    >
      {loading ? (
        <Skel className="h-[7.5rem]" />
      ) : running.length === 0 ? (
        <p className="py-2 text-[0.75rem] text-faint">No agent is running right now.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {running.slice(0, 6).map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex items-center gap-2 py-1.5 text-[0.75rem]">
              <Lamp tone="ok" pulse />
              <span className="rounded-[2px] border border-sodium/40 px-1 text-[0.625rem] font-semibold uppercase text-sodium">
                {KIND_LABEL[a.kind ?? ""] ?? a.kind ?? "agent"}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink" title={a.task ?? undefined}>
                {a.name}
              </span>
              <span className="tnum font-semibold text-sodium" title="running time">
                {runTime(a, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const FILTERS = ["all", "running", "done", "failed"] as const;

export function Agents({ agents, loading }: { agents: Agent[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const all = useMemo(() => sortAgents(arr(agents)), [agents]);
  const list = f === "all" ? all : all.filter((a) => a.status === f);
  const running = all.filter((a) => a.status === "running").length;
  const { shown, toggle } = useShowMore(list, 8);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel
      title="AI agents"
      meta={loading ? null : `${running} working · from state/agents.json and live delegate processes · running first`}
      right={<Chips value={f} options={FILTERS} onChange={setF} label="Filter agents" />}
    >
      {loading ? (
        <Skel className="h-[12.5rem]" />
      ) : list.length === 0 ? (
        <Empty>No agents{f !== "all" ? ` ${f}` : ""}. Subagents and delegate CLIs add themselves to state/agents.json while they work.</Empty>
      ) : (
        <>
          <ul className="grid gap-2 lg:grid-cols-2">
            {shown.map((a, i) => {
              const t = tone(a.status);
              const k = `${a.name}-${i}`;
              const isOpen = open === k;
              return (
                <li key={k} className="rounded-[3px] border border-rule bg-raised/50">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)} className="w-full p-3 text-left">
                    <div className="flex items-center gap-2">
                      <span className="rounded-[2px] border border-sodium/40 px-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-sodium">
                        {KIND_LABEL[a.kind ?? ""] ?? a.kind ?? "agent"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.78125rem] font-semibold">{a.name}</span>
                      <span className="tnum text-[0.75rem] font-semibold text-ink" title={a.status === "running" ? "running for" : "ran for"}>
                        {runTime(a, now)}
                      </span>
                      <Pill tone={t}>
                        <Lamp tone={t} pulse={a.status === "running"} />
                        {a.status ?? "unknown"}
                      </Pill>
                    </div>
                    {a.task && <p className={`mt-1.5 text-[0.75rem] leading-snug text-muted ${isOpen ? "" : "line-clamp-2"}`}>{a.task}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[0.65625rem] text-faint">
                      <span>started {ago(a.started, now)}</span>
                      <span>updated {ago(a.updated, now)}</span>
                      {isOpen && a.output && <span className="max-w-full break-all">{a.output}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {toggle}
        </>
      )}
    </Panel>
  );
}
