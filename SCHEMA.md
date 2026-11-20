# Clip Factory Ops — snapshot contract (v1)

The dashboard is read-only over one JSON document, `snapshot.json`, built on the main laptop by
`pipeline/clipper/dashboard_export.py` every 2 minutes and POSTed to the deployed app:

    POST https://<app>/api/ingest
    Authorization: Bearer <INGEST_TOKEN>
    Content-Type: application/json
    Content-Encoding: gzip            (body is gzip of the JSON)

The app stores it in a private Vercel Blob (`snapshot.json`, allowOverwrite) and serves it to the
logged-in UI from `GET /api/snapshot`. The UI polls every 30 s and shows "data age" from
`generated_at` (stale > 6 min = amber, > 15 min = red "pipeline host offline").

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
    "laptop2": { "online": true, "temp_c": 71, "job": "restyle_l2", "last_seen": "..." }
  },

  // every long-running pipeline process from start_gta6.ps1
  "jobs": [
    { "key": "clip_run", "name": "Clip run", "group": "produce",   // produce|publish|support|research
      "running": true, "pid": 38400, "started": "...", "cpu_pct": 4.1,
      "last_line": "[16:58:04] round 1: 58 block(s) to process", "last_line_at": "...",
      "errors_1h": 0 }
  ],

  // the funnel, left to right
  "pipeline": {
    "streams_tracked": 72, "streams_live": 3,
    "blocks_pending": 58,
    "clips_total": 1840, "clips_ready": 900,
    "restyled": 600, "rerender_pending": 272, "held": 21,
    "seo_v3": 700, "reels_built": 500,
    "eligible_to_upload": 140,           // passes publish.new_style_ids gate, not yet uploaded
    "uploaded_yt": 60, "scheduled_yt": 18, "posted_ig": 25
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
      "focus": "IShowSpeed", "audience": "US", "tz": "America/New_York",
      "times": ["12:50","16:20","18:20","19:20"],
      "running": true, "uploads_today": 3, "uploads_total": 14,
      "next_slot": "...", "last_event": "uploaded qSyo5d-dVzA_37 -> ...", "last_event_at": "...",
      "status": "ok|limit|error|off|appeal", "note": "daily upload limit" }
  ],

  // everything booked or done, both platforms, last 48 h + all future
  "schedule": [
    { "clip_id": "qSyo5d-dVzA_37", "account": "8000", "platform": "youtube",
      "title": "IShowSpeed Asks ...", "creator": "IShowSpeed",
      "slot": "2026-11-21T01:00:00Z",          // publish time (null = immediate)
      "done_at": "...",                        // uploaded/posted time
      "state": "scheduled|published|posted|failed",
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
```
