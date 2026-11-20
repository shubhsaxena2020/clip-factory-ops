import type { Account, EventItem, Job, L2AgentLine, L2Slots, LiveJob, Machine, MachineLoad, RenderJob, ScheduleItem, Snapshot, DockerStatus, Laptop2, Tick } from "./types";
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
  at: number | null; // browser time the last tick arrived
  tickAt: number | null; // the last tick's own reading time (laptop clock)
  cpu: number | null;
  ram: number | null;
  main: MachineLoad | null;
  l2: Laptop2 | null;
  l2agent: L2AgentLine | null;
  jobs: Record<string, LiveJob>;
  jobsAt: number | null;
  doing: Record<string, [string, string | null]>;
  events: EventItem[];
  docker: DockerStatus | null;
  slots: L2Slots | null;
}

export const EMPTY_LIVE: LiveState = {
  at: null,
  tickAt: null,
  cpu: null,
  ram: null,
  main: null,
  l2: null,
  l2agent: null,
  jobs: {},
  jobsAt: null,
  doing: {},
  events: [],
  docker: null,
  slots: null,
};

export const eventKey = (e: EventItem) => `${e.at}|${e.source}|${e.text}`;

export function applyTick(prev: LiveState, t: Tick): LiveState {
  const events = t.events?.length ? dedupe([...t.events, ...prev.events]).slice(0, 200) : prev.events;
  const tickAt = toMs(t.t);
  // CPU, RAM and the main load are ONE reading: they move together or not at all
  const main = t.cpu != null || t.main ? { ...(t.main ?? {}), cpu: t.cpu ?? t.main?.cpu ?? null, ram: t.ram ?? t.main?.ram ?? null } : null;
  return {
    at: Date.now(),
    tickAt: main ? tickAt : prev.tickAt,
    cpu: main ? main.cpu ?? null : prev.cpu,
    ram: main ? main.ram ?? null : prev.ram,
    main: main ?? prev.main,
    l2: t.l2 ?? prev.l2,
    l2agent: t.l2_agent
      ? { ...t.l2_agent, specs: t.l2_agent.specs ?? prev.l2agent?.specs, disks: t.l2_agent.disks ?? prev.l2agent?.disks }
      : prev.l2agent,
    jobs: t.jobs ?? prev.jobs,
    jobsAt: t.jobs ? tickAt : prev.jobsAt,
    doing: t.doing ? { ...prev.doing, ...t.doing } : prev.doing,
    events,
    docker: t.docker ?? prev.docker,
    slots: t.slots !== undefined ? t.slots : prev.slots,
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

/** Where each live reading on the page came from and when it was read (ms). The header, the KPI
 *  tiles and the Machines page all read the overlaid snapshot, so they always show the same reading. */
export interface LiveMeta {
  mainAt: number | null;
  mainSrc: "tick" | "snapshot";
  l2At: number | null;
  l2Src: "agent" | "snapshot";
}

/** An agent line counts as "now" for this long after it was read. */
const L2_FRESH_MS = 10_000;
const JOBS_FRESH_MS = 15_000;

/**
 * The snapshot with the newest reading of every live metric laid over it. Each metric group comes
 * from ONE reading (the newer of: the last 1-s tick, the snapshot) and is written to every field
 * that shows it, together with the time it was read (s.live_meta), so nothing on the page can mix
 * two moments. Applies whether or not the channel is up: old readings stay, labelled with their age.
 */
export function overlay(s: Snapshot | null, live: LiveState, now: number = Date.now()): (Snapshot & { live_meta: LiveMeta }) | null {
  if (!s) return null;
  const sys = s.system ?? {};
  const machines = s.machines ?? {};
  // ---- main laptop: tick vs snapshot, whichever was read later ----
  const snapMainAt = toMs(sys.cpu_at) ?? toMs(machines.main?.at) ?? toMs(s.generated_at);
  const useTick = live.tickAt != null && live.cpu != null && (snapMainAt == null || live.tickAt >= snapMainAt);
  const mainLoad: MachineLoad = useTick
    ? { ...(machines.main?.load ?? {}), ...(live.main ?? {}), cpu: live.cpu, ram: live.ram }
    : { ...(machines.main?.load ?? {}), cpu: sys.cpu_pct ?? machines.main?.load?.cpu ?? null, ram: sys.ram_pct ?? machines.main?.load?.ram ?? null };
  const mainAt = useTick ? live.tickAt : snapMainAt;
  // ---- laptop 2: the agent line vs the snapshot's laptop-2 reading ----
  const l2m = machines.laptop2 ?? {};
  const a = live.l2agent;
  const agentAt = toMs(a?.t);
  const snapL2At = toMs(l2m.at) ?? toMs(sys.laptop2?.last_seen);
  const useAgent = a != null && agentAt != null && (snapL2At == null || agentAt >= snapL2At);
  const agentFresh = useAgent && live.at != null && now - live.at < L2_FRESH_MS && live.l2?.src !== "snapshot";
  const l2Online = useAgent ? (agentFresh ? true : (live.l2?.online ?? sys.laptop2?.online ?? null)) : (sys.laptop2?.online ?? l2m.online ?? null);
  const l2Load = useAgent ? (a.load ?? l2m.load) : l2m.load;
  const laptop2: Machine = useAgent
    ? {
        ...l2m,
        online: l2Online,
        load: l2Load,
        procs: a.procs ?? l2m.procs,
        renders: a.renders ?? l2m.renders,
        active: a.active ?? activeRenders(a.renders ?? l2m.renders),
        specs: a.specs ?? l2m.specs,
        disks: a.disks ?? l2m.disks,
        at: a.t ?? l2m.at,
      }
    : { ...l2m, online: l2Online, active: l2m.active ?? activeRenders(l2m.renders) };
  if (live.slots && (live.at ?? 0) >= (toMs(s.generated_at) ?? 0)) laptop2.slots = live.slots;
  const l2At = useAgent ? agentAt : snapL2At;
  const sysL2: Laptop2 = {
    ...(sys.laptop2 ?? {}),
    online: l2Online,
    temp_c: l2Online === false ? null : (l2Load?.temp_c ?? sys.laptop2?.temp_c ?? null),
    last_temp_c: l2Load?.temp_c ?? sys.laptop2?.last_temp_c ?? null,
    cpu: l2Online === false ? null : (l2Load?.cpu ?? null),
    last_seen: useAgent ? (a.t ?? null) : (sys.laptop2?.last_seen ?? l2m.at ?? null),
  };
  // ---- jobs: live process state while it is recent ----
  const jobsLive = live.jobsAt != null && live.at != null && now - live.at < JOBS_FRESH_MS && (live.jobsAt >= (toMs(s.generated_at) ?? 0));
  const jobs = arr(s.jobs).map((j): Job => {
    const lj = jobsLive ? live.jobs[j.key] : undefined;
    const d = live.doing[j.key];
    const running = lj?.running ?? j.running;
    return {
      ...j,
      running,
      state: running ? "running" : j.state === "running" ? "stopped" : j.state,
      pid: lj ? (lj.pid ?? j.pid) : j.pid,
      cpu_pct: lj ? (lj.cpu_pct ?? null) : j.cpu_pct,
      last_line: d?.[0] ?? j.last_line,
      last_line_at: d?.[1] ?? j.last_line_at,
    };
  });
  return {
    ...s,
    system: { ...sys, cpu_pct: mainLoad.cpu ?? null, ram_pct: mainLoad.ram ?? null, cpu_at: mainAt != null ? new Date(mainAt).toISOString() : sys.cpu_at, laptop2: sysL2 },
    jobs,
    events: dedupe([...live.events, ...arr(s.events)]).slice(0, 200),
    machines: {
      ...machines,
      main: { role: "pipeline host", ...(machines.main ?? {}), load: mainLoad, at: mainAt != null ? new Date(mainAt).toISOString() : machines.main?.at },
      laptop2,
    },
    docker: live.docker && (toMs(live.docker.at) ?? 0) >= (toMs(s.docker?.at) ?? 0) ? live.docker : s.docker,
    live_meta: { mainAt, mainSrc: useTick ? "tick" : "snapshot", l2At, l2Src: useAgent ? "agent" : "snapshot" },
  };
}

export const ACTIVE_STAGES = ["upload", "base", "render"];

/** Renders holding a laptop-2 slot (an agent without the `active` field: count by stage). */
export function activeRenders(r: RenderJob[] | null | undefined): number {
  return arr(r).filter((x) => ACTIVE_STAGES.includes(x.stage ?? "")).length;
}

/** Age class of a live reading: "now" while ticks keep it fresh, then "recent", then "old". */
export function freshness(at: number | null | undefined, now: number): "now" | "recent" | "old" | "none" {
  if (at == null) return "none";
  const age = now - at;
  return age < 5_000 ? "now" : age < 90_000 ? "recent" : "old";
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
          .filter((r) => ACTIVE_STAGES.includes(r.stage ?? ""))
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
