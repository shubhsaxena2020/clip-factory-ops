import type { Account, EventItem, Job, L2AgentLine, LiveJob, MachineLoad, ScheduleItem, Snapshot, DockerStatus, Laptop2, Tick } from "./types";
import { arr, toMs } from "./format";

// ---------- schedule states: evidence or "unverified" ----------

/** A row is "scheduled"/"published" only with evidence. Snapshots from the v1 exporter carry no
 *  verified_by at all; their plan-based states are shown as unverified rather than trusted. */
export function rowState(it: ScheduleItem): string {
  const s = it.state ?? "unknown";
  if ((s === "scheduled" || s === "published") && !("verified_by" in it)) return "unverified";
  return s;
}

export const STATE_LABEL: Record<string, string> = {
  scheduled: "scheduled",
  published: "published",
  posted: "posted",
  failed: "failed",
  problem: "private / not scheduled",
  unverified: "unverified",
  disabled: "account disabled",
};

export const itemMs = (it: ScheduleItem) => toMs(it.slot) ?? toMs(it.done_at);

// ---------- live overlay ----------

export interface LiveState {
  at: number | null;
  cpu: number | null;
  ram: number | null;
  main: MachineLoad | null;
  l2: Laptop2 | null;
  l2agent: L2AgentLine | null;
  jobs: Record<string, LiveJob>;
  doing: Record<string, [string, string | null]>;
  events: EventItem[];
  docker: DockerStatus | null;
}

export const EMPTY_LIVE: LiveState = {
  at: null,
  cpu: null,
  ram: null,
  main: null,
  l2: null,
  l2agent: null,
  jobs: {},
  doing: {},
  events: [],
  docker: null,
};

export const eventKey = (e: EventItem) => `${e.at}|${e.source}|${e.text}`;

export function applyTick(prev: LiveState, t: Tick): LiveState {
  const events = t.events?.length ? dedupe([...t.events, ...prev.events]).slice(0, 200) : prev.events;
  return {
    at: Date.now(),
    cpu: t.cpu ?? prev.cpu,
    ram: t.ram ?? prev.ram,
    main: t.main ?? prev.main,
    l2: t.l2 ?? prev.l2,
    l2agent: t.l2_agent
      ? { ...t.l2_agent, specs: t.l2_agent.specs ?? prev.l2agent?.specs, disks: t.l2_agent.disks ?? prev.l2agent?.disks }
      : prev.l2agent,
    jobs: t.jobs ?? prev.jobs,
    doing: t.doing ? { ...prev.doing, ...t.doing } : prev.doing,
    events,
    docker: t.docker ?? prev.docker,
  };
}

function dedupe(list: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  const out: EventItem[] = [];
  for (const e of list) {
    const k = eventKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.sort((a, b) => (toMs(b.at) ?? 0) - (toMs(a.at) ?? 0));
}

/** The snapshot with the live channel's newer readings laid over it (only while live). */
export function overlay(s: Snapshot | null, live: LiveState, isLive: boolean): Snapshot | null {
  if (!s || !isLive) return s;
  const sys = s.system ?? {};
  const jobs = arr(s.jobs).map((j): Job => {
    const lj = live.jobs[j.key];
    const d = live.doing[j.key];
    const running = lj?.running ?? j.running;
    return {
      ...j,
      running,
      state: running ? "running" : j.state === "running" ? "stopped" : j.state,
      pid: lj ? lj.pid ?? j.pid : j.pid,
      cpu_pct: lj ? lj.cpu_pct ?? null : j.cpu_pct,
      last_line: d?.[0] ?? j.last_line,
      last_line_at: d?.[1] ?? j.last_line_at,
    };
  });
  const machines = s.machines ?? {};
  const l2m = machines.laptop2 ?? {};
  const a = live.l2agent;
  return {
    ...s,
    system: {
      ...sys,
      cpu_pct: live.cpu ?? sys.cpu_pct,
      ram_pct: live.ram ?? sys.ram_pct,
      laptop2: { ...(sys.laptop2 ?? {}), ...(live.l2 ?? {}) },
    },
    jobs,
    events: dedupe([...live.events, ...arr(s.events)]).slice(0, 200),
    machines: {
      ...machines,
      main:
        machines.main || live.main
          ? { role: "pipeline host", ...(machines.main ?? {}), load: { ...(machines.main?.load ?? {}), ...(live.main ?? {}) } }
          : machines.main,
      laptop2: a
        ? {
            ...l2m,
            online: true,
            load: a.load ?? l2m.load,
            procs: a.procs ?? l2m.procs,
            renders: a.renders ?? l2m.renders,
            specs: a.specs ?? l2m.specs,
            disks: a.disks ?? l2m.disks,
            at: a.t ?? l2m.at,
          }
        : l2m,
    },
    docker: live.docker ?? s.docker,
  };
}

// ---------- status taxonomy (counts + drill-down rows) ----------

export interface StatusRow {
  key: string;
  title: string;
  detail?: string | null;
  at?: string | null;
  href?: string | null;
}

export interface StatusGroup {
  key: string;
  label: string;
  tone: "ok" | "warn" | "err" | "sodium" | "faint" | "ink";
  hint: string;
  rows: StatusRow[];
}

const acct = (a?: string | null, p?: string | null) => `${(p ?? "").toLowerCase() === "instagram" ? "IG" : "YT"} ${a ?? "?"}`;

export function taxonomy(s: Snapshot | null): StatusGroup[] {
  const sched = arr(s?.schedule);
  const jobs = arr(s?.jobs);
  const renders = arr(s?.machines?.laptop2?.renders);
  const accounts = arr(s?.accounts);
  const row = (it: ScheduleItem): StatusRow => ({
    key: `${it.platform}-${it.account}-${it.clip_id}`,
    title: it.title ?? it.clip_id,
    detail: `${acct(it.account, it.platform)} · ${it.clip_id}${it.verified_by ? ` · by ${it.verified_by.replace("_", " ")}` : ""}`,
    at: it.slot ?? it.done_at,
    href: it.url,
  });
  const st = (it: ScheduleItem) => rowState(it);
  const blockedAcc = accounts.filter((a: Account) => ["limit", "appeal", "disabled"].includes((a.status ?? "").toLowerCase()));
  const errJobs = jobs.filter((j) => j.state === "stopped" || (j.running === false && j.state !== "finished" && j.state !== "off") || (j.errors_1h ?? 0) > 0);
  return [
    {
      key: "progress",
      label: "In progress",
      tone: "sodium",
      hint: "running pipeline jobs and laptop-2 renders under way",
      rows: [
        ...renders
          .filter((r) => ["upload", "queued", "base", "render"].includes(r.stage ?? ""))
          .map((r) => ({ key: `r-${r.clip}`, title: `render ${r.clip}`, detail: `laptop 2 · ${r.path} · ${r.stage}`, at: r.started })),
        ...jobs.filter((j) => j.running).map((j) => ({ key: `j-${j.key}`, title: j.name ?? j.key, detail: j.last_line, at: j.last_line_at })),
      ],
    },
    {
      key: "published",
      label: "Published",
      tone: "ok",
      hint: "confirmed public on YouTube, or posted on Instagram (last 48 h)",
      rows: sched.filter((i) => ["published", "posted"].includes(st(i))).map(row),
    },
    {
      key: "scheduled",
      label: "Scheduled",
      tone: "ok",
      hint: "confirmed scheduled in YouTube Studio by the audit",
      rows: sched.filter((i) => st(i) === "scheduled").map(row),
    },
    {
      key: "unverified",
      label: "Unverified",
      tone: "faint",
      hint: "uploaded, but no Studio audit or public check has confirmed it yet",
      rows: sched.filter((i) => st(i) === "unverified").map(row),
    },
    {
      key: "private",
      label: "Private / not public",
      tone: "err",
      hint: "Studio shows private/draft/missing, or still not public after its slot",
      rows: sched.filter((i) => st(i) === "problem" || (st(i) === "failed" && i.verified_by === "public_check")).map(row),
    },
    {
      key: "failed",
      label: "Failed",
      tone: "err",
      hint: "upload/post attempts that failed (log) and renders that failed",
      rows: [
        ...sched.filter((i) => st(i) === "failed" && i.verified_by !== "public_check").map(row),
        ...renders.filter((r) => r.stage === "failed").map((r) => ({ key: `rf-${r.clip}`, title: `render ${r.clip}`, detail: r.error, at: r.ended })),
      ],
    },
    {
      key: "blocked",
      label: "Blocked",
      tone: "warn",
      hint: "holds, daily upload limits, checkpoints, disabled accounts",
      rows: [
        ...blockedAcc.map((a) => ({ key: `a-${a.platform}-${a.key}`, title: `${acct(a.key, a.platform)}: ${a.note ?? a.status}`, detail: a.last_event, at: a.last_event_at })),
        ...arr(s?.holds).map((h) => ({ key: `h-${h.id}`, title: `hold ${h.id}`, detail: h.reason })),
      ],
    },
    {
      key: "errors",
      label: "Errors",
      tone: "err",
      hint: "jobs that stopped when they should run, and jobs with errors in the last hour",
      rows: errJobs.map((j) => ({
        key: `e-${j.key}`,
        title: `${j.name ?? j.key}${j.running ? "" : " (not running)"}`,
        detail: `${j.errors_1h ?? 0} error(s) in 1 h · ${j.last_line ?? ""}`,
        at: j.last_line_at,
      })),
    },
  ];
}
