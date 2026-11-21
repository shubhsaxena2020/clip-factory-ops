# Clip Factory Ops dashboard

A read-only operator console for the GTA 6 clip pipeline. The data side (snapshot exporter `dashboard_export.py`, live server
`dashboard_live.py`, collectors `dashboard_sys.py`, `dashboard_more.py`, laptop-2 agent `l2_agent.py`) lives in the
clip-factory repo under `pipeline/clipper/`; this repo mirrors the Vercel app (production deploys run from
clip-factory's `dashboard/` folder). It runs on Vercel at
https://clip-factory-ops.vercel.app and sits behind its own password login.

## How data flows

```
main laptop                                              Vercel (project clip-factory-ops)
dashboard_export.py  --every 5 min, gzip POST-->  /api/ingest  --put-->  Blob snapshot.json + history/*
dashboard_live.py    --tunnel URL when it changes-->  /api/live-url  --put-->  Blob live.json
   |  127.0.0.1:8787 /ws (WebSocket) + /live (SSE)                       /api/live-token (session) -> {token, url}
   '-- cloudflared quick tunnel <------ browser WebSocket: snapshot on change (<= every 15 s), tick every 0.5 s
                                        browser fallback: /api/snapshot every 15 s while live is down
```

- Live: while someone watches, the laptop sends a tick every 0.5 s (CPU, RAM, GPU, temperature,
  network, jobs, what each job is doing, new events) and the full snapshot when it changes (rebuilt every
  15 s). Nobody watching = no per-tick work. Measured 2026-11-21: dashboard_live 0.46% of all 14
  cores with one viewer at 2 ticks/s (0.52% before at 1 tick/s), 0.001% with none, ~65 MB.
- Motion: the infinite decorative animations (moving belt, parcels, pulsing lamps) are off unless
  `<html class="motion">`: any of them kept the browser drawing 60 frames/s (an open tab measured
  ~1.3 cores in a software-rendered browser, ~0.3 core without them).
- Nothing can be live while the laptop sleeps or is offline: the header pill then reads
  "Last seen Xm ago (laptop offline)", a banner says since when, and the page shows the last stored
  5-minute snapshot. It reconnects by itself (re-reading the tunnel URL every 2-20 s) once the laptop's
  scheduled task "GTA6 clip factory" has started dashboard_live again and it has POSTed its new URL.
- Laptop 2 readings come from `l2_agent.py` over one long-lived ssh session (live) or one ssh call
  per exporter pass. Shorts views/likes/comments are looked up with yt-dlp on laptop 2 every 20 min.
- `SCHEMA.md` is the data contract (snapshot v1). The UI treats every field as optional and shows
  an empty state instead of crashing when something is null or missing.
- `/api/ingest` checks `Authorization: Bearer $INGEST_TOKEN` (constant-time), accepts gzip
  (`Content-Encoding: gzip` or gzip magic bytes) or plain JSON, rejects bodies over 5 MB (before and
  after decompression) and anything without `schema === 1`, then overwrites `snapshot.json`.
- History: on the first ingest of each UTC hour it appends one point (YouTube uploaded, IG posted,
  scheduled, clips, restyled, eligible) to `history/<IST date>.json`. The cumulative activity chart
  reads the last 30 days. Snapshots with `pipeline: null` are not recorded.
- `/api/snapshot` returns `{ snapshot, history, stored_at }` to a logged-in session only.

## Auth

- `/login` posts the password to `/api/login`, which compares it with `DASHBOARD_PASSWORD`
  (HMAC digests, constant time; 10 failures per IP per 10 min per instance are throttled).
- Success sets `cfo_session`: httpOnly, Secure (in production), SameSite=Lax, 30 days. The value is
  `v1.<expiry>.<HMAC-SHA256>`; the key is derived from `DASHBOARD_PASSWORD` + `INGEST_TOKEN`, or from
  `SESSION_SECRET` when set. Changing the password signs everyone out.
- `src/proxy.ts` (Next 16's middleware) protects everything except `/login`, `/api/login` and
  `/api/ingest`. Unauthenticated API calls get 401, pages redirect to `/login`.
- Vercel Deployment Protection only covers preview/deployment URLs; the production domain is
  reachable directly and the app's own login is the gate.

## Environment variables (Vercel, production)

| Name | Purpose |
|---|---|
| `INGEST_TOKEN` | Bearer token the exporter sends to `/api/ingest` |
| `DASHBOARD_PASSWORD` | Login password |
| `BLOB_READ_WRITE_TOKEN` | Added automatically by the connected Blob store `clip-factory-ops-data` |
| `SESSION_SECRET` | Optional; overrides the derived session key |

The source of truth for the two secrets is `E:\clipfactory\state\dashboard.env`, which also holds
`DASHBOARD_URL` for the exporter. Never commit `.env*` files; they are git-ignored.

## Local development

```
npm install
node scripts/make-fixture.mjs          # fixtures/sample-snapshot.json + empty-snapshot.json
npm run dev                            # or: npm run build && npm start
```

Without `BLOB_READ_WRITE_TOKEN` the store falls back to files in `.local-store/` and, before any
ingest, reads `LOCAL_SNAPSHOT_PATH` (e.g. `E:\clipfactory\state\snapshot.json`) or the sample
fixture. Put `INGEST_TOKEN`, `DASHBOARD_PASSWORD` and optionally `LOCAL_SNAPSHOT_PATH` in
`.env.local`. Do not build on the main laptop (CPU cap 75 %): run lint/tsc/build on laptop 2, or let
`vercel deploy --prod` build remotely.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Deploy

```
vercel deploy --prod --scope shubh-saxena-s-projects
```

`vercel.json` pins the framework to Next.js (the project was created from the CLI without a preset).

## Layout

- `src/app/page.tsx` server-renders the console with the stored snapshot. `src/components/Console.tsx`
  holds the state: `src/lib/useLive.ts` (EventSource, token refresh, backoff, hidden-tab close) lays
  live ticks over the snapshot (`src/lib/derive.ts`), and the stored snapshot is polled as fallback.
- Five pages (`src/components/Pages.tsx`, tab in the URL hash), each in titled sections, most important
  first, content max 80rem wide: Overview (Right now: KPIs, posting next incl. planned Instagram slots,
  needs attention - The funnel: production line, status board - Accounts: tiles with audience - Activity:
  live activity, agents, load split), Publishing (Schedule: 48 h timeline, posts by day - Accounts: account
  health table, account detail - Queue and holds: queue, why clips are held back, held list), Production
  (Machines + render split - Jobs - Streams and counts, Docker), Intel (agents, research, discovery, code
  activity), Analytics (Audience: subscribers/followers - Performance: Studio metrics, Shorts stats, Studio
  export - Output and cost: cumulative uploads, running cost, Claude usage, Vercel deploys).
- Sizes are in rem; `html { font-size: 110% }` in `globals.css` scales the whole UI. Motion
  (count-up numbers, sliding events, sparkline, belt, rings) is off under prefers-reduced-motion.
- One component per section in `src/components/`; shared primitives (panel, tick meter, lamps,
  pills, time with IST/ET hover) in `ui.tsx`. Charts are hand-rolled SVG, no chart library.
- Fonts: Big Shoulders (display numerals and headings) and JetBrains Mono, via `next/font`.
- Times show in IST by default; the header toggle switches to ET (remembered per browser) and every
  timestamp shows both zones on hover.
