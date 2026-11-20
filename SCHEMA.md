# Clip Factory Ops — snapshot contract (v1, with v2 additions)

The dashboard is read-only over one JSON document, `snapshot.json`, built on the main laptop by
`pipeline/clipper/dashboard_export.py` every 5 minutes and POSTed to the deployed app:

    POST https://<app>/api/ingest
    Authorization: Bearer <INGEST_TOKEN>
    Content-Type: application/json
    Content-Encoding: gzip            (body is gzip of the JSON)

The app stores it in a private Vercel Blob (`snapshot.json`, allowOverwrite) and serves it to the
logged-in UI from `GET /api/snapshot`. That stored copy is the fallback: the UI polls it every 15 s
only while the laptop's live channel (below) is down. All v2 additions are optional fields; the UI
treats a v1 snapshot's plan-based "scheduled"/"published" rows (no `verified_by` key) as unverified.

All times are ISO-8601 UTC strings (`...Z` or `+00:00`). Missing data = `null` / empty list, never
an absent top-level key. Size target: < 1.5 MB uncompressed.

No secrets, passwords, cookies or email addresses anywhere in the snapshot. Accounts are named by
key ("8000") and channel display name only.

```jsonc
{
  "schema": 1,
  "generated_at": "2026-11-20T12:00:00Z",
  "host": "main-laptop",

  "system": {
    "cpu_pct": 61.2,              // Processor Utility, what Task Manager shows
    "cpu_at": "...",              // when cpu_pct / ram_pct were read (live: the newest tick's time)
    "cpu_limit_pct": 75,
    "ram_pct": 58.0,
    "gpu_pct": null,              // optional
    "disk_e_free_gb": 412.3,
    "laptop2": { "online": true, "temp_c": 71,   // temp_c is null while offline
                 "last_temp_c": 71,              // last reading, belongs to last_seen
                 "job": "restyle_l2", "last_seen": "..." }
  },

  // every long-running pipeline process from start_gta6.ps1
  "jobs": [
    { "key": "clip_run", "name": "Clip run", "group": "produce",   // produce|publish|support|research
      "running": true, "state": "running",   // running|finished (one-shot job done)|off (uploads off)|stopped
      "pid": 38400, "started": "...", "cpu_pct": 4.1,      // process tree, per-process deltas, % of machine
      "last_line": "[16:58:04] round 1: 58 block(s) to process", "last_line_at": "...",
      "errors_1h": 0 }                     // error/fail lines in 1 h; upload-limit retries are not counted
  ],

  // the funnel, left to right
  "pipeline": {
    "streams_tracked": 72, "streams_live": 3,
    "blocks_pending": 58,                // = round.queued (kept for old readers)
    "blocks_round": 3, "blocks_at": "...",  // = round.n / round.at
    // the running clip run's CURRENT round, from the newest live_MMDD_HHMM.log (read whole, every pass)
    "round": { "n": 1, "state": "running|scanning|waiting|starting", "queued": 67, "started": 6,
               "done": 4,            // started blocks that state.json marks done (blocks_done)
               "failed": 0, "in_progress": 2, "remaining": 63,   // remaining = queued - done - failed
               "at": "...", "log": "live_1120_1957.log" },
    "clips_total": 1840, "clips_ready": 900,
    "restyled": 600, "rerender_pending": 272, "held": 21,
    "seo_v3": 700, "reels_built": 500,
    "eligible_to_upload": 140,           // passes publish.new_style_ids gate, not yet uploaded
    "uploaded_yt": 60,                   // uploaded to Studio, any state
    "published_yt": 40,                  // confirmed public (verify_public or the Studio audit)
    "scheduled_yt": 18,                  // confirmed scheduled by the Studio audit only
    "unverified_yt": 0, "problem_yt": 2, // problem = failed + private/draft/missing
    "posted_ig": 25, "problem_ig": 0, "unverified_ig": 0,
    "disabled_ig": 11,                   // posts of a permanently disabled IG account, counted apart
    "studio_audit_at": "...", "publish_check_at": "..."
  },

  "streams": [
    { "id": "qSyo5d-dVzA", "platform": "youtube",   // youtube|twitch
      "title": "...", "creator": "IShowSpeed", "audience": "US",
      "url": "https://...", "live_status": "is_live|was_live|...",
      "started_at": "...", "clips": 37, "ready": 12, "uploaded": 4,
      "thumb": "https://i.ytimg.com/vi/<id>/mqdefault.jpg" }   // null for twitch
  ],

  "accounts": [
    { "key": "8000", "platform": "youtube", "name": "<channel display name or null>",
      "focus": "US streamers except Speed & Kai Cenat",     // account_focus rendered as words
      "focus_raw": ["aud:US", "!speed", "!kai cenat"],
      "audience": "US", "tz": "America/New_York",
      "times": ["12:50","16:20","18:20","19:20"],
      "running": true, "uploads_today": 3,   // uploads since 00:00 IST
      "uploads_24h": 4, "uploads_total": 14,
      // the account's own calendar day (its tz), counted by publish time, per verified state
      "today": { "date": "2026-11-20", "done": 1, "scheduled": 2, "unverified": 0, "problem": 0 },
      "next_slot": "...", "last_event": "uploaded qSyo5d-dVzA_37 -> ...", "last_event_at": "...",
      "status": "ok|limit|error|off|appeal|disabled", "note": "daily upload limit" }
  ],

  // everything booked or done, both platforms, last 48 h + all future
  "schedule": [
    { "clip_id": "qSyo5d-dVzA_37", "account": "8000", "platform": "youtube",
      "title": "IShowSpeed Asks ...", "creator": "IShowSpeed",
      "slot": "2026-11-21T01:00:00Z",          // publish time (null = immediate)
      "done_at": "...",                        // uploaded/posted time
      "state": "scheduled|published|posted|failed|problem|unverified|disabled",
      "verified_by": "studio|public_check|log|account|null",   // evidence for the state
      "url": "https://youtube.com/shorts/p-1xKDUVrJA",
      "thumb": "https://i.ytimg.com/vi/p-1xKDUVrJA/hqdefault.jpg" }
  ],

  // next clips the uploaders will pick, best first (top 30)
  "queue": [
    { "clip_id": "...", "creator": "...", "title": "...", "score": 7.4,
      "audience": "US", "duration_s": 24.5, "layout": "stacked", "caption_mode": "1w",
      "fresh_h": 5.2, "restyled": true, "held": false }
  ],

  "holds": [ { "id": "...", "reason": "..." } ],

  // merged, newest first, max 200
  "events": [
    { "at": "...", "kind": "upload|post|fail|discover|render|restyle|error|system",
      "source": "uploader_8000", "text": "uploaded qSyo5d-dVzA_37 -> https://..." }
  ],

  "discovery": {
    "last_run": "...",
    "added": [ { "id": "...", "channel": "...", "title": "...", "kind": "live|vod", "score": 0 } ],
    "top": [ { "id": "...", "channel": "...", "title": "...", "kind": "live", "watching": 0, "views": 0 } ]
  },

  "research": [
    { "name": "trends_2026-11-20", "updated": "...", "files": 4,
      "summary": "first ~600 chars of SUMMARY/FINDINGS/README" }
  ],

  // AI agents working on the operation (Claude Code subagents + delegate CLIs)
  "agents": [
    { "name": "Music-claim risk audit", "kind": "claude-subagent|codex|opencode|hermes|antigravity",
      "task": "...", "status": "running|done|failed", "started": "...", "updated": "...",
      "output": "E:\\clipfactory\\research\\music_risk_2026-11-20" }
  ],

  // optional: from Studio analytics snapshots
  "analytics": {
    "updated": "...",
    "totals": { "views": 0, "subs": 0, "videos": 0 },
    "per_account": [ { "key": "8000", "views": 0, "subs": 0, "videos": 0 } ],
    "top_videos": [ { "title": "...", "url": "...", "views": 0, "account": "8000" } ],
    "ab": [ { "arm": "caption 1w", "n": 0, "avg_views": 0 } ]
  },

  // optional: Claude Code usage on this machine (from ~/.claude/projects/*.jsonl)
  "claude": { "tokens_5h": 0, "tokens_today": 0, "sessions_today": 0, "output_tokens_today": 0 },

  // v3: the Overview headline numbers, one definition each (see "Metric definitions")
  "kpis": { "day": "2026-11-20", "tz": "Asia/Kolkata", "as_of": "...",
            "posted_today": { "yt": 3, "ig": 4, "total": 7, "awaiting_check": 0, "problem": 0 },
            "scheduled_24h": { "yt": 17, "unverified": 4, "problem": 0 },
            "source": "publish_plan*.json + ig_plan_*.json; states from publish_check.json and studio_audit.json" },
  // v3: state/studio_stats.jsonl (clipper.studio_stats: Studio's / Instagram's own numbers per Short at
  // +3 h, +12 h and daily), newest row per (platform, Short, checkpoint); null until the file exists
  "studio_stats": { "updated": "...", "n": 15, "rows": [ { "platform": "yt|ig", "short", "clip_id", "account",
                    "mark": "3h|12h|daily", "at", "views", "impressions", "stayed_pct", "avg_view_s", "likes", "traffic": {} } ] },
  // v3: state/dashboard_truth.json from the self-check job (clipper.dashboard_truth, every 10 min)
  "truth": { "at": "...", "ok": true, "n_checks": 87, "n_fail": 0, "n_skip": 0, "error": null,
             "snapshot_at": "...", "tick_at": "...",
             "checks": [ { "key", "label", "page", "expected", "shown", "tol", "ok": true, "source", "note" } ] }
}

  // v2 extras (exporter only; the live server copies them from snapshot.json)
  "machines": {
    "main":    { "role": "pipeline host", "specs": { "host", "cpu", "cores", "threads", "ram_gb", "gpus": [], "os" },
                 "disks": [ { "drive": "E:", "total_gb", "free_gb", "used_pct" } ],
                 "load": { "cpu", "ram", "gpu", "temp_c", "net_up_bps", "net_down_bps" }, "at": "..." },
    "laptop2": { "role": "render worker", "specs", "disks", "load", "online",
                 "procs": [ { "name": "ffmpeg", "pid", "cpu_pct", "clip", "cmd", "started" } ],
                 "renders": [ { "clip", "path": "restyle_l2|clip_run|remote", "stage": "upload|base|render|done|failed|stale",
                                "started", "ended", "elapsed_s", "wall_s", "error" } ],
                 // upload/base/render hold a render slot: a live l2_job.py/ffmpeg works on the clip, or its
                 // files are < 10 min old. stale = left on disk, nothing works on it (holds no slot).
                 "active": 1,
                 "slots": { "held": [ { "slot", "owner", "clip", "since" } ], "capacity": 1, "hot": true,
                            "hot_reading": "87 20:45:36", "temp_c": 80 }, "at": "..." } },
  "docker": { "ok": true, "containers": [ { "name", "image", "state", "status", "health", "ports",
                                            "cpu_pct", "mem_mib", "mem_limit_mib" } ], "at": "..." },
  "git": [ { "repo": "clip-factory", "sha", "author", "at", "message" } ],      // local git log, 5 min
  "vercel": { "ok": true, "deployments": [ { "age", "url", "state", "env", "duration" } ], "at": "..." },
  "platform_stats": { "updated": "...", "every_min": 20,                         // yt-dlp on laptop 2
    "shorts": [ { "short", "clip_id", "account", "title", "slot", "views", "likes", "comments",
                  "availability", "views_1h", "at" } ],                          // top 60 by views
    "totals": { "shorts": 15, "views": 1420, "likes": 18, "comments": 0 },       // over ALL Shorts with stats
    "series": { "8000": [ ["<iso>", 1234] ] } }                                    // total views per account
}
```

## Evidence rules for schedule states

- Future slot: `scheduled` only when `state/studio_audit.json` saw it scheduled; Studio
  private/draft/missing = `problem`; no audit row = `unverified`.
- Slot passed: the newest definitive check wins. Public (verify_public or Studio) = `published`;
  verify_public private/removed = `failed`; Studio private/draft/missing = `problem`; otherwise
  `unverified`.
- Instagram: a plan row with a reel code is `posted`; the audit's `reel_ok: false` = `problem`;
  rows of a permanently disabled account = `disabled`.

## Live channel (laptop -> browser)

`pipeline/clipper/dashboard_live.py` serves the same messages two ways: `GET /live?t=<token>` as
Server-Sent Events and `GET /ws?t=<token>` as a WebSocket (text frames `{"e": event, "d": data}`).
The browser uses `/ws` through the cloudflared quick tunnel, because quick tunnels hold SSE
responses back (measured: ticks arrived in bursts with 12 s gaps) while WebSocket frames pass at once. Token = `<exp>.<hex HMAC-SHA256(INGEST_TOKEN, exp)>`,
minted by the session-protected `GET /api/live-token` (10 min). The tunnel URL reaches the app via
`POST /api/live-url` (bearer INGEST_TOKEN, `https://*.trycloudflare.com` only, stored as Blob
`live.json`, written only when it changes).

    event: snapshot   the full document above (+ "live": true), on connect; rebuilt every 15 s and sent
                      when its content changed (at least every 120 s). Its system/machines readings are
                      the newest tick's and the newest laptop-2 agent line's, never an older reading.
    event: hello      { doing: {job: [line, at]}, jobs, l2_agent, l2, slots, docker }
    event: tick       every 1 s: { t (= when this reading was taken), cpu, ram, main: {cpu, ram, gpu, temp_c, net_*},
                        l2: {online, cpu, ram, temp_c, last_temp_c, last_seen, src: "agent"|"snapshot"},
                        jobs: {key: {running, pid, cpu_pct}}           (CPU every 1 s; process list every 4 s)
                        doing?: {key: [line, at]}                      (changed lines only)
                        events?: [ event rows ]                        (new since the last tick)
                        l2_agent?: { t, load, procs, renders, active, busy, specs?, disks? }  (each new agent
                                   line: load every 1 s, procs/renders every 3 s, kept on every line)
                        slots?: { held, capacity, hot, ... }           (when they change)
                        docker?: { ... }                               (every 60 s) }
    event: expired    the token ran out; the browser reconnects with a new one

The browser lays the newest reading of each live group over the snapshot (`lib/derive.ts` `overlay`):
main laptop = the last tick or the snapshot's `system.cpu_at` reading, whichever is newer; laptop 2 =
the last agent line or the snapshot's `machines.laptop2.at` reading. The SAME value is written to
every place that shows it (header, KPI tile, Machines page), with its reading time; every live number
shows its age ("now" under 5 s, then seconds/minutes, greyed after 15 s). Count-ups take 350 ms and a
timer lands the exact value at 450 ms, so a shown number trails the real one by under 0.6 s; live
percentages (CPU) are printed without a count-up.

## Metric definitions

Every number and label on the five pages: what it means and where it comes from. "Plans" =
`state/publish_plan*.json` (YouTube; `publish_plan.json` is account 6000) and `state/ig_plan_*.json`
(Instagram, `skipped` rows excluded). "Evidence" = `state/publish_check.json` (clipper.verify_public)
and `state/studio_audit.json` (the Studio/IG audit), applied by the evidence rules above. Every row
marked ✓ is recomputed independently every 10 min by `clipper.dashboard_truth` (badge in the header).

### Header (all pages)

| Shown | Definition | Source |
|---|---|---|
| Live / Last seen … | "Live" while a tick arrived under 6 s ago; else how old the newest data is and why (link down / laptop offline) | WebSocket ticks; snapshot `generated_at` |
| data verified hh:mm ✓ / N mismatches | the last self-check: N = checks whose recomputed value differs beyond tolerance; click for every check | `truth` (state/dashboard_truth.json) |
| Main CPU % · cap 75 ✓ | Windows 11 Task Manager CPU = `\Processor Information(_Total)\% Processor Utility`, 1-s window, capped at 100; age next to it | tick `cpu` (1 s) else `system.cpu_pct` at `system.cpu_at` |
| CPU sparkline | the last 60 tick readings | ticks |
| Laptop 2: CPU %, °C ✓ | Windows 10 Task Manager CPU = `\Processor(_Total)\% Processor Time`; hottest ACPI thermal zone; age next to it | l2_agent line (1 s) else the exporter's 5-min probe |

### Overview

| Shown | Definition | Source |
|---|---|---|
| Posted today · DD MMM IST ✓ | YouTube rows whose publish time (slot, else upload time) is on today's IST date and passed AND confirmed public, plus Instagram rows posted (reel code; audit `reel_ok` not false) on today's IST date. The day is always IST, never the zone toggle | `kpis.posted_today` (plans + evidence) |
| · N awaiting check ✓ | YouTube rows whose publish time passed today with no public/private verdict yet | `kpis.posted_today.awaiting_check` |
| Scheduled, next 24 h ✓ | YouTube rows with a slot in (now, now+24 h] that the Studio audit saw `scheduled`. Instagram is never pre-booked (posted live at each slot) | `kpis.scheduled_24h.yt` |
| + N unverified ✓ | same window, no audit verdict | `kpis.scheduled_24h.unverified` |
| Eligible queue ✓ | clips the uploaders would take now: their own gate `publish.candidates` ∩ `publish.new_style_ids` (ready/approved, file + metadata exist, safe title, new style, SEO v3, not held, not planned or claimed on any channel). The exporter reloads the gate when publish.py/seo_hard.py change | `pipeline.eligible_to_upload` |
| N ready clips held back ✓ | ready/approved clips whose clip id or stream id is in hold.json | `pipeline.held` |
| Live streams of N tracked ✓ | streams in state.json with `live_status == is_live` (last stream refresh) / all streams in state.json | `pipeline.streams_live`, `streams_tracked` |
| Main CPU tile ✓ | identical to the header (same overlaid reading, same formatting, no count-up) | as header |
| Laptop 2 CPU tile ✓ | identical to the header | as header |
| N renders running ✓ | render jobs on laptop 2 holding a slot: a live `l2_job.py`/ffmpeg works on the clip (or its files arrived under 10 min ago). Leftover dirs are `stale`, not counted | l2_agent `active` |
| N slots allowed (hot) ✓ | the slot rule of fx.remote: 2 at ≤ 75 °C, 1 at ≤ 85 °C or after any reading above 85 °C in the last 4 h, 0 above 85 °C | `machines.laptop2.slots` (state/l2_slots + temperature) |
| Production line: Streams ✓ | streams in state.json; "live now" = is_live | `pipeline.streams_*` |
| Blocks left · round N ✓ | the running clip run's current round, from the NEWEST `live_MMDD_HHMM.log`: blocks queued at the round's start minus blocks done (state.json `blocks_done`) minus failed; "D of Q done · P in progress". "clip run starting" before round 1; "round done: reading streams" between rounds | `pipeline.round` |
| Clips cut / N ready ✓ | every clip in state.json / status ready or approved (held and uploaded ones included) | `clips_total`, `clips_ready` |
| Restyled / to re-render ✓ | clips in the new style (restyle_done.txt or carrying caption_mode), only clips that still exist / rerender_pending.txt minus restyled | `restyled`, `rerender_pending` |
| SEO v3 / reels built ✓ | meta_v2 packages with seo_version ≥ 3 / reel folders with meta.json | `seo_v3`, `reels_built` |
| Scheduled (all upcoming) ✓ | YouTube rows with a FUTURE slot that the audit saw scheduled, any date ahead; "unverified" = every YouTube row with no verdict (past or future) | `scheduled_yt`, `unverified_yt` |
| Published · YouTube, public ✓ | YouTube rows confirmed public (all time) | `published_yt` |
| Posted · Instagram ✓ | Instagram rows posted (all time, disabled account excluded) | `posted_ig` |
| Uploaded to Studio ✓ | every YouTube plan row, any state | `uploaded_yt` |
| Problems ✓ | YouTube: Studio private/draft/missing, or not public after its slot (`failed`); Instagram: audit `reel_ok: false` (all time) | `problem_yt + problem_ig` |
| Status board counts | schedule rows (last 48 h + future) by evidence state; In progress = running jobs + active renders; Blocked = limit/appeal/disabled accounts + holds; Errors = jobs stopped or with error lines in 1 h | `schedule`, `jobs`, `machines.laptop2.renders` |
| Now doing / Events | each running job's newest log line / classified log lines, newest first (200 max) | `jobs[].last_line`, `events` (+ ticks) |
| Next 5 posts | upcoming schedule rows (scheduled, unverified, problem) by slot | `schedule` |
| Account tiles ring | the account's own calendar day (its posting tz: ET, or IST for 1000), counted by publish time: out (published/posted) + booked (scheduled) of its daily slots | `accounts[].today` |
| Load split | busy cores = CPU % × hardware threads, per laptop | overlaid machine loads |

### Publishing

| Shown | Definition | Source |
|---|---|---|
| Schedule, 48 hours | every plan row with a slot or done time from 24 h ago to 24 h ahead, one lane per account, marker = evidence state; axis in the chosen zone | `schedule` |
| Posts by day | the same rows grouped by calendar day in the chosen zone (IST/ET toggle), newest first; chip counts per state | `schedule` |
| Upload queue | the 30 best eligible clips by the uploaders' score | `queue` |
| Held back | N hold.json entries (a clip or a whole stream) · M ready clips held by them | `holds`, `pipeline.held` |
| Account detail: Today (tz) ✓ | as the ring: out / sched / unverified / bad on the account's own day | `accounts[].today` |
| Uploads (posts), last 24 h ✓ | plan rows with upload (IG: post) time in the last 24 h, regardless of publish time | `accounts[].uploads_24h` |
| Total uploaded (posted) ✓ | rows in the account's plan | `accounts[].uploads_total` |
| Next free slot | the next posting time the uploader would book (YouTube) / post at (Instagram) | `accounts[].next_slot` |

### Production

| Shown | Definition | Source |
|---|---|---|
| Machines: CPU/RAM/GPU/temperature/network + age | the overlaid reading (as header); GPU = 3D engines summed, capped at 100; temperature = hottest ACPI zone | ticks / agent / snapshot |
| Renders on laptop 2 (last 6 h) ✓ | job dirs under `D:\work\render_test\jobs` (restyle), `livejobs\<cfg>` (clip run) and the old `in\` path, with stage; "N running · M slots held of K allowed" | l2_agent `renders`, `slots` |
| Processes (laptop 2) | python/ffmpeg/hermes/node/yt-dlp with CPU % of the machine | l2_agent `procs` |
| Jobs: state ✓, CPU %, errors in 1 h | running = a python whose command line matches start_gta6.ps1's pattern (rechecked every 4 s; CPU of its process tree every 1 s, share of the whole machine); errors = error/fail log lines in the last hour (upload-limit retries excluded) | tick `jobs`; `jobs[]` |
| Tracked streams: clips / ready / on YouTube | per stream: clips cut, ready/approved, uploaded to Studio on any channel | `streams[]` |
| Pipeline counts ✓ | the production-line numbers above, each with its definition | `pipeline` |
| Docker | containers; CPU = docker stats, % of ONE core | `docker` |

### Intel

| Shown | Definition | Source |
|---|---|---|
| AI agents | state/agents.json plus live codex/opencode/hermes/agy processes | `agents` |
| Research | folders in E:\clipfactory\research, newest change first, summary = SUMMARY/FINDINGS/README | `research` |
| Discovery | the last discovery pass: streams added and top candidates | `discovery` |
| Code activity | local git log of the three repos, every 5 min | `git` |

### Analytics

| Shown | Definition | Source |
|---|---|---|
| Studio metrics per Short (+3 h / +12 h / daily) | YouTube Studio's (and Instagram's) own numbers per Short at each checkpoint, newest row per Short and checkpoint: views (YT: EXTERNAL_VIEWS since publish; IG: plays), impressions, stayed %, average view s, likes. The analytics authority | `studio_stats` (state/studio_stats.jsonl, clipper.studio_stats) |
| Shorts performance: views/likes/comments | PUBLIC counts from anonymous yt-dlp on laptop 2 every 20 min, totals over ALL Shorts with stats; "+N/h" = views gained over the last ~hour | `platform_stats` |
| Studio analytics export | the newest export file in E:\clipfactory\analytics | `analytics` |
| Cumulative uploads, 30 days | one point per hour: YouTube uploads (any state) and Instagram posts, cumulative | Blob history rollup |
| Claude usage | tokens (input + cache-creation + output; cache reads excluded) in the last 5 h / since 00:00 IST | `claude` |
| Vercel deploys | `vercel ls`, every 10 min | `vercel` |
