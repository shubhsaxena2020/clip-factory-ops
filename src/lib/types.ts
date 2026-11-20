// Snapshot contract v1 — mirrors dashboard/SCHEMA.md.
// Every field is treated as possibly null/missing at runtime: the UI must never crash on a gap.

export type ISO = string;

export interface Laptop2 {
  online?: boolean | null;
  temp_c?: number | null;
  job?: string | null;
  last_seen?: ISO | null;
}

export interface SystemInfo {
  cpu_pct?: number | null;
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
  blocks_pending?: number | null;
  clips_total?: number | null;
  clips_ready?: number | null;
  restyled?: number | null;
  rerender_pending?: number | null;
  held?: number | null;
  seo_v3?: number | null;
  reels_built?: number | null;
  eligible_to_upload?: number | null;
  uploaded_yt?: number | null;
  scheduled_yt?: number | null;
  posted_ig?: number | null;
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

export type AccountStatus = "ok" | "limit" | "error" | "off" | "appeal" | string;

export interface Account {
  key: string;
  platform?: "youtube" | "instagram" | string | null;
  name?: string | null;
  focus?: string | null;
  audience?: string | null;
  tz?: string | null;
  times?: string[] | null;
  running?: boolean | null;
  uploads_today?: number | null;
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
  state?: "scheduled" | "published" | "posted" | "failed" | string | null;
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
