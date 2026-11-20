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
    "blocks_pending": 58,                // blocks queued when the CURRENT round started (not a countdown)
    "blocks_round": 3, "blocks_at": "...",
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
  "claude": { "tokens_5h": 0, "tokens_today": 0, "sessions_today": 0, "output_tokens_today": 0 }
}

  // v2 extras (exporter only; the live server copies them from snapshot.json)
  "machines": {
    "main":    { "role": "pipeline host", "specs": { "host", "cpu", "cores", "threads", "ram_gb", "gpus": [], "os" },
                 "disks": [ { "drive": "E:", "total_gb", "free_gb", "used_pct" } ],
                 "load": { "cpu", "ram", "gpu", "temp_c", "net_up_bps", "net_down_bps" }, "at": "..." },
    "laptop2": { "role": "render worker", "specs", "disks", "load", "online",
                 "procs": [ { "name": "ffmpeg", "pid", "cpu_pct", "clip", "cmd", "started" } ],
                 "renders": [ { "clip", "path": "restyle_l2|remote", "stage": "upload|queued|base|render|done|failed",
                                "started", "ended", "elapsed_s", "wall_s", "error" } ], "at": "..." } },
  "docker": { "ok": true, "containers": [ { "name", "image", "state", "status", "health", "ports",
                                            "cpu_pct", "mem_mib", "mem_limit_mib" } ], "at": "..." },
  "git": [ { "repo": "clip-factory", "sha", "author", "at", "message" } ],      // local git log, 5 min
  "vercel": { "ok": true, "deployments": [ { "age", "url", "state", "env", "duration" } ], "at": "..." },
  "platform_stats": { "updated": "...", "every_min": 20,                         // yt-dlp on laptop 2
    "shorts": [ { "short", "clip_id", "account", "title", "slot", "views", "likes", "comments",
                  "availability", "views_1h", "at" } ],
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

    event: snapshot   the full document above (+ "live": true), on connect and every 30 s if changed
    event: hello      { doing: {job: [line, at]}, jobs, l2_agent, docker }
    event: tick       every 1 s: { t, cpu, ram, main: {cpu, ram, gpu, temp_c, net_*},
                        l2: {online, temp_c, last_temp_c, last_seen},
                        jobs?: {key: {running, pid, cpu_pct}}          (every 4 s)
                        doing?: {key: [line, at]}                      (changed lines only)
                        events?: [ event rows ]                        (new since the last tick)
                        l2_agent?: { t, load, procs, renders, specs?, disks? }  (every ~3 s)
                        docker?: { ... }                               (every 60 s) }
    event: expired    the token ran out; the browser reconnects with a new one
