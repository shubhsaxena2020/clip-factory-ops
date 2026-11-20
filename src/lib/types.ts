// Snapshot contract v1 — mirrors dashboard/SCHEMA.md.
// Every field is treated as possibly null/missing at runtime: the UI must never crash on a gap.

export type ISO = string;

export interface Laptop2 {
  online?: boolean | null;
  temp_c?: number | null; // null while offline
  last_temp_c?: number | null; // last reading, with last_seen
  job?: string | null;
  last_seen?: ISO | null; // time of the reading (laptop 2's clock for an agent line)
  cpu?: number | null; // % Processor Time (Windows 10 Task Manager), live ticks only
  ram?: number | null;
  src?: "agent" | "snapshot" | string | null; // live ticks: the l2_agent session, or the exporter's last probe
}

export interface SystemInfo {
  cpu_pct?: number | null;
  cpu_at?: ISO | null; // when cpu_pct/ram_pct were read
  cpu_limit_pct?: number | null;
  ram_pct?: number | null;
  gpu_pct?: number | null;
  disk_e_free_gb?: number | null;
  laptop2?: Laptop2 | null;
}

export type JobGroup = "produce" | "publish" | "support" | "research" | string;

export interface Job {
  key: string;
  name?: string | null;
  group?: JobGroup | null;
  running?: boolean | null;
  state?: "running" | "finished" | "off" | "stopped" | string | null;
  pid?: number | null;
  started?: ISO | null;
  cpu_pct?: number | null;
  last_line?: string | null;
  last_line_at?: ISO | null;
  errors_1h?: number | null;
}

export interface Pipeline {
  streams_tracked?: number | null;
  streams_live?: number | null;
  blocks_pending?: number | null; // blocks queued at the start of the current clip-run round
  blocks_round?: number | null;
  blocks_at?: ISO | null;
  clips_total?: number | null;
  clips_ready?: number | null;
  restyled?: number | null;
  rerender_pending?: number | null;
  held?: number | null;
  seo_v3?: number | null;
  reels_built?: number | null;
  eligible_to_upload?: number | null;
  uploaded_yt?: number | null; // uploaded to Studio, any state
  published_yt?: number | null; // confirmed public
  scheduled_yt?: number | null; // confirmed scheduled by the Studio audit
  unverified_yt?: number | null;
  problem_yt?: number | null; // failed + problem
  posted_ig?: number | null;
  problem_ig?: number | null;
  unverified_ig?: number | null;
  disabled_ig?: number | null; // posts of a permanently disabled account
  studio_audit_at?: ISO | null;
  publish_check_at?: ISO | null;
  round?: ClipRound | null;
}

/** The running clip run's current round, from the newest live_MMDD_HHMM.log. */
export interface ClipRound {
  n?: number | null; // null = the run is still reading its streams before round 1
  state?: "running" | "scanning" | "waiting" | "starting" | string | null;
  queued?: number | null; // blocks queued when the round started
  started?: number | null;
  done?: number | null; // block marked done in state.json
  failed?: number | null;
  in_progress?: number | null;
  remaining?: number | null; // queued - done - failed
  at?: ISO | null; // when the round started
  log?: string | null;
}

/** Overview headline numbers, computed by the exporter (one definition each, IST day). */
export interface Kpis {
  day?: string | null; // YYYY-MM-DD, IST
  tz?: string | null;
  as_of?: ISO | null;
  posted_today?: { yt?: number | null; ig?: number | null; total?: number | null; awaiting_check?: number | null; problem?: number | null } | null;
  scheduled_24h?: { yt?: number | null; unverified?: number | null; problem?: number | null } | null;
  source?: string | null;
}

export interface TruthCheck {
  key: string;
  label: string;
  page?: string | null;
  expected?: unknown;
  shown?: unknown;
  tol?: number | null;
  ok: boolean | null; // null = skipped
  source?: string | null;
  note?: string | null;
}

/** state/dashboard_truth.json from the self-check job. */
export interface Truth {
  at?: ISO | null;
  ok?: boolean | null;
  n_checks?: number | null;
  n_fail?: number | null;
  n_skip?: number | null;
  checks?: TruthCheck[] | null;
  snapshot_at?: ISO | null;
  tick_at?: ISO | null;
  error?: string | null;
}

export interface StudioStatRow {
  short: string;
  clip_id?: string | null;
  account?: string | null;
  title?: string | null;
  mark?: string | null; // the collector's checkpoint: "3h" | "12h" | "daily"
  platform?: "yt" | "ig" | string | null;
  at?: ISO | null;
  [metric: string]: unknown;
}

export interface StudioStats {
  updated?: ISO | null;
  n?: number | null;
  rows?: StudioStatRow[] | null;
}

export interface L2Slots {
  held?: { slot: string; owner?: string | null; clip?: string | null; since?: ISO | null }[] | null;
  capacity?: number | null; // render slots the temperature rule allows now (null = no reading)
  hot?: boolean | null; // above 85 C within the last 4 h: 1 slot at most
  hot_reading?: string | null;
  temp_c?: number | null;
}

export interface Stream {
  id: string;
  platform?: "youtube" | "twitch" | string | null;
  title?: string | null;
  creator?: string | null;
  audience?: string | null;
  url?: string | null;
  live_status?: string | null;
  started_at?: ISO | null;
  clips?: number | null;
  ready?: number | null;
  uploaded?: number | null;
  thumb?: string | null;
}

/** The account's own calendar day (its posting tz), counted by publish time. */
export interface AccountDay {
  date?: string | null;
  done?: number | null;
  scheduled?: number | null;
  unverified?: number | null;
  problem?: number | null;
}

export type AccountStatus = "ok" | "limit" | "error" | "off" | "appeal" | string;

export interface Account {
  key: string;
  platform?: "youtube" | "instagram" | string | null;
  name?: string | null;
  focus?: string | null; // plain words
  focus_raw?: string[] | null;
  audience?: string | null;
  tz?: string | null;
  times?: string[] | null;
  running?: boolean | null;
  uploads_today?: number | null; // uploads since 00:00 IST
  uploads_24h?: number | null;
  today?: AccountDay | null;
  uploads_total?: number | null;
  next_slot?: ISO | null;
  last_event?: string | null;
  last_event_at?: ISO | null;
  status?: AccountStatus | null;
  note?: string | null;
}

export interface ScheduleItem {
  clip_id: string;
  account?: string | null;
  platform?: string | null;
  title?: string | null;
  creator?: string | null;
  slot?: ISO | null;
  done_at?: ISO | null;
  state?: "scheduled" | "published" | "posted" | "failed" | "problem" | "unverified" | string | null;
  verified_by?: "studio" | "public_check" | "log" | string | null;
  url?: string | null;
  thumb?: string | null;
}

export interface QueueItem {
  clip_id: string;
  creator?: string | null;
  title?: string | null;
  score?: number | null;
  audience?: string | null;
  duration_s?: number | null;
  layout?: string | null;
  caption_mode?: string | null;
  fresh_h?: number | null;
  restyled?: boolean | null;
  held?: boolean | null;
}

export interface Hold {
  id: string;
  reason?: string | null;
}

export interface EventItem {
  at?: ISO | null;
  kind?: string | null;
  source?: string | null;
  text?: string | null;
}

export interface DiscoveryEntry {
  id: string;
  channel?: string | null;
  title?: string | null;
  kind?: string | null;
  score?: number | null;
  watching?: number | null;
  views?: number | null;
}

export interface Discovery {
  last_run?: ISO | string | null;
  added?: DiscoveryEntry[] | null;
  top?: DiscoveryEntry[] | null;
}

export interface ResearchItem {
  name: string;
  updated?: ISO | null;
  files?: number | null;
  summary?: string | null;
}

export interface Agent {
  name: string;
  kind?: string | null;
  task?: string | null;
  status?: "running" | "done" | "failed" | string | null;
  started?: ISO | null;
  updated?: ISO | null;
  output?: string | null;
}

export interface Analytics {
  updated?: ISO | null;
  totals?: { views?: number | null; subs?: number | null; videos?: number | null } | null;
  per_account?: { key: string; views?: number | null; subs?: number | null; videos?: number | null }[] | null;
  top_videos?: { title?: string | null; url?: string | null; views?: number | null; account?: string | null }[] | null;
  ab?: { arm: string; n?: number | null; avg_views?: number | null }[] | null;
}

export interface ClaudeUsage {
  tokens_5h?: number | null;
  tokens_today?: number | null;
  sessions_today?: number | null;
  output_tokens_today?: number | null;
}

export interface Snapshot {
  schema: 1;
  generated_at?: ISO | null;
  host?: string | null;
  system?: SystemInfo | null;
  jobs?: Job[] | null;
  pipeline?: Pipeline | null;
  streams?: Stream[] | null;
  accounts?: Account[] | null;
  schedule?: ScheduleItem[] | null;
  queue?: QueueItem[] | null;
  holds?: Hold[] | null;
  events?: EventItem[] | null;
  discovery?: Discovery | null;
  research?: ResearchItem[] | null;
  agents?: Agent[] | null;
  analytics?: Analytics | null;
  claude?: ClaudeUsage | null;
  live?: boolean | null; // true when it came over the laptop's live channel
  machines?: { main?: Machine | null; laptop2?: Machine | null } | null;
  docker?: DockerStatus | null;
  git?: Commit[] | null;
  vercel?: VercelStatus | null;
  platform_stats?: PlatformStats | null;
  kpis?: Kpis | null;
  studio_stats?: StudioStats | null;
  truth?: Truth | null;
}

export interface MachineLoad {
  cpu?: number | null;
  ram?: number | null;
  gpu?: number | null;
  temp_c?: number | null;
  net_up_bps?: number | null;
  net_down_bps?: number | null;
}

export interface Disk {
  drive: string;
  total_gb?: number | null;
  free_gb?: number | null;
  used_pct?: number | null;
}

export interface MachineProc {
  name?: string | null;
  pid?: number | null;
  cpu_pct?: number | null;
  clip?: string | null;
  cmd?: string | null;
  started?: ISO | null;
}

export interface RenderJob {
  clip: string;
  path?: "restyle_l2" | "clip_run" | "remote" | string | null;
  stage?: "upload" | "base" | "render" | "done" | "failed" | "stale" | string | null; // upload/base/render hold a slot
  started?: ISO | null;
  ended?: ISO | null;
  elapsed_s?: number | null;
  wall_s?: number | null;
  error?: string | null;
}

export interface Machine {
  role?: string | null;
  specs?: { host?: string | null; cpu?: string | null; cores?: number | null; threads?: number | null; ram_gb?: number | null; gpus?: string[] | null; os?: string | null } | null;
  disks?: Disk[] | null;
  load?: MachineLoad | null;
  procs?: MachineProc[] | null;
  renders?: RenderJob[] | null;
  active?: number | null; // renders holding a slot (laptop 2)
  slots?: L2Slots | null;
  online?: boolean | null;
  at?: ISO | null;
}

export interface Container {
  name?: string | null;
  image?: string | null;
  state?: string | null;
  status?: string | null;
  health?: string | null;
  ports?: string | null;
  cpu_pct?: number | null;
  mem_mib?: number | null;
  mem_limit_mib?: number | null;
}

export interface DockerStatus {
  ok?: boolean | null;
  error?: string | null;
  containers?: Container[] | null;
  at?: ISO | null;
}

export interface Commit {
  repo: string;
  sha?: string | null;
  author?: string | null;
  at?: ISO | null;
  message?: string | null;
}

export interface VercelStatus {
  ok?: boolean | null;
  error?: string | null;
  at?: ISO | null;
  deployments?: { age?: string | null; url?: string | null; state?: string | null; env?: string | null; duration?: string | null }[] | null;
}

export interface ShortStat {
  short: string;
  clip_id?: string | null;
  account?: string | null;
  title?: string | null;
  slot?: ISO | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  availability?: string | null;
  views_1h?: number | null;
  at?: ISO | null;
}

export interface PlatformStats {
  updated?: ISO | null;
  every_min?: number | null;
  shorts?: ShortStat[] | null; // top 60 by views
  totals?: { shorts?: number | null; views?: number | null; likes?: number | null; comments?: number | null } | null; // all Shorts with stats
  series?: Record<string, [ISO, number][]> | null;
}

// Daily rollup kept by /api/ingest (history/YYYY-MM-DD.json, IST calendar day).
export interface HistoryPoint {
  at: ISO;
  uploaded_yt: number;
  posted_ig: number;
  scheduled_yt: number;
  clips_total: number;
  restyled: number;
  eligible_to_upload: number;
}

export interface HistoryDay {
  date: string; // YYYY-MM-DD (IST)
  points: HistoryPoint[]; // at most one per hour
}

export interface SnapshotResponse {
  snapshot: Snapshot | null;
  history: HistoryDay[];
  stored_at: ISO | null;
}

// ---------- live channel (laptop SSE) ----------

export interface LiveJob {
  running?: boolean | null;
  pid?: number | null;
  cpu_pct?: number | null;
}

export interface L2AgentLine {
  t?: ISO | null;
  load?: MachineLoad | null;
  procs?: MachineProc[] | null;
  renders?: RenderJob[] | null;
  active?: number | null;
  busy?: string[] | null;
  specs?: Machine["specs"];
  disks?: Disk[] | null;
}

export interface Tick {
  t: ISO;
  cpu?: number | null;
  ram?: number | null;
  main?: MachineLoad | null;
  l2?: Laptop2 | null;
  l2_agent?: L2AgentLine | null;
  docker?: DockerStatus | null;
  jobs?: Record<string, LiveJob>;
  doing?: Record<string, [string, ISO | null]>;
  events?: EventItem[];
  slots?: L2Slots | null;
}

export interface LiveTokenResponse {
  token: string;
  exp: number;
  url: string | null;
  url_at: ISO | null;
}
