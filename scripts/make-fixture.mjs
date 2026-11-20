// Writes fixtures/sample-snapshot.json (realistic, times relative to now) and
// fixtures/empty-snapshot.json (null-heavy) for local development and UI tests.
//   node scripts/make-fixture.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.now();
const iso = (offMin) => new Date(now + offMin * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const streams = [
  ["qSyo5d-dVzA", "youtube", "🔴PLAYING GTA 6 EARLY ACCESS GAMEPLAY GET IN HERE!", "IShowSpeed", "US", "was_live", 37, 12, 6],
  ["VZqAPdUvqnQ", "youtube", "PLAYING GTA 6 FOR THE FIRST TIME (PART 1)", "Kai Cenat Live", "US", "was_live", 41, 15, 5],
  ["H-4PyJlhI9g", "youtube", "PLAYING GTA 6 FOR THE FIRST TIME (PART 2)", "Kai Cenat Live", "US", "was_live", 33, 9, 3],
  ["LMbea5SozeM", "youtube", "Welcome to Vice City!  GTA 6 LIVE with Mythpat", "Mythpat", "IN", "was_live", 28, 10, 4],
  ["169ZzvPxvvM", "youtube", "MY FIRST DAY IN VICE CITY | GTA 6 GAMEPLAY #1", "Techno Gamerz", "IN", "not_live", 22, 8, 3],
  ["0C_LS2lUWdg", "youtube", "🔴LIVE | GTA 6 | BUNGULATION EDITION | #BUNGULATE", "TheBurntPeanut", "US", "is_live", 9, 2, 0],
  ["HzzzoomJ-Os", "youtube", "GTA 6 but every crash is a jump", "Typical Gamer", "US", "was_live", 31, 11, 4],
  ["UwH_ZrLszBk", "youtube", "GTA 6 races are RIGGED", "DarkViperAU", "US", "was_live", 19, 6, 2],
  ["tw2618003341", "twitch", "GTA 6 DAY 3 — CASEOH IN VICE CITY", "CaseOh", "US", "was_live", 24, 7, 2],
  ["tw2618994120", "twitch", "VICE CITY RP FIRST LOOK", "xQc", "US", "is_live", 6, 0, 0],
  ["YylVwL4UIFU", "youtube", "GTA 6 LIVE — Total Gaming in Leonida", "Total Gaming", "IN", "is_live", 14, 4, 1],
].map(([id, platform, title, creator, audience, live_status, clips, ready, uploaded], i) => ({
  id,
  platform,
  title,
  creator,
  audience,
  url: platform === "youtube" ? `https://www.youtube.com/watch?v=${id}` : `https://www.twitch.tv/videos/${id.slice(2)}`,
  live_status,
  started_at: iso(-60 * (2 + i * 5)),
  clips,
  ready,
  uploaded,
  thumb: platform === "youtube" ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null,
}));

const ytAccounts = [
  ["6000", "Vice City Clips", "IShowSpeed", "US", "America/New_York", ["12:50", "16:20", "18:20", "19:20"], "ok", null],
  ["7000", "Leonida Daily", "Kai Cenat", "US", "America/New_York", ["11:30", "15:00", "18:00", "21:00"], "ok", null],
  ["8000", "Speed Moments", "IShowSpeed", "US", "America/New_York", ["12:50", "16:20", "18:20", "19:20"], "limit", "daily upload limit"],
  ["9000", "GTA6 Funny Clips", "CaseOh", "US", "America/New_York", ["13:00", "17:00", "19:00", "22:00"], "ok", null],
  ["1000", "Desi Vice City", "Techno Gamerz", "IN", "Asia/Kolkata", ["12:00", "18:00", "20:30", "22:00"], "appeal", "strike appeal pending"],
  ["2000", "Mythpat Shorts GTA", "Mythpat", "IN", "Asia/Kolkata", ["11:00", "17:30", "20:00", "21:30"], "error", "Studio upload dialog timed out"],
];
const igAccounts = [
  ["6000", "vicecity.clips", "IShowSpeed", "US", "ok"],
  ["7000", "leonida.daily", "Kai Cenat", "US", "ok"],
  ["8000", "speed.gta6", "IShowSpeed", "US", "ok"],
  ["9000", "gta6.funny", "CaseOh", "US", "limit"],
  ["1000", "desi.vicecity", "Techno Gamerz", "IN", "off"],
];

const accounts = [
  ...ytAccounts.map(([key, name, focus, audience, tz, times, status, note], i) => ({
    key,
    platform: "youtube",
    name,
    focus,
    audience,
    tz,
    times,
    running: status !== "error",
    uploads_today: [3, 2, 4, 1, 0, 2][i],
    uploads_total: [14, 11, 19, 8, 6, 9][i],
    next_slot: status === "limit" ? null : iso(17 + i * 41),
    last_event: status === "error" ? "upload failed: Studio dialog timeout (180 s)" : `uploaded ${streams[i].id}_${10 + i} -> https://youtube.com/shorts/x${i}`,
    last_event_at: iso(-12 - i * 23),
    status,
    note,
  })),
  ...igAccounts.map(([key, name, focus, audience, status], i) => ({
    key,
    platform: "instagram",
    name,
    focus,
    audience,
    tz: audience === "IN" ? "Asia/Kolkata" : "America/New_York",
    times: ["09:30", "13:00", "18:30", "21:00"],
    running: status !== "off",
    uploads_today: [2, 3, 1, 4, 0][i],
    uploads_total: [25, 18, 9, 22, 0][i],
    next_slot: status === "ok" ? iso(33 + i * 57) : null,
    last_event: status === "off" ? null : `posted reel ${streams[i + 2].id}_0${i + 1}`,
    last_event_at: status === "off" ? null : iso(-30 - i * 47),
    status,
    note: status === "limit" ? "4/day reached" : null,
  })),
];

const titles = [
  "IShowSpeed Regrets Watching Jason SLAP A REDNECK In GTA 6 💀",
  "IShowSpeed Spots A CRAZY PLANE CRASH In GTA 6 🤯",
  "Kai Cenat Gets ROBBED By A Gator In Vice City 😭",
  "CaseOh Tries To Park A Boat In GTA 6",
  "Mythpat Discovers The Vice City Beach Glitch",
  "Techno Gamerz Steals A Police Heli In GTA 6 🚁",
  "Typical Gamer Tried A High Speed Jump And It Went Wrong 💀",
  "DarkViperAU Calls GTA 6 Rigged",
];
const schedule = [];
for (let i = 0; i < 34; i++) {
  const acc = pick(accounts);
  const st = pick(streams.slice(0, 9));
  const off = -48 * 60 + i * 150 + Math.floor(rnd() * 60);
  const past = off < 0;
  const yt = acc.platform === "youtube";
  const vid = `v${i.toString(36)}${st.id.slice(0, 6)}`;
  const failed = past && rnd() < 0.08;
  schedule.push({
    clip_id: `${st.id}_${String(10 + i).padStart(2, "0")}`,
    account: acc.key,
    platform: acc.platform,
    title: pick(titles),
    creator: st.creator,
    slot: iso(off),
    done_at: past && !failed ? iso(off + 2) : yt ? iso(off - 600) : null,
    state: failed ? "failed" : past ? (yt ? "published" : "posted") : "scheduled",
    url: failed ? null : yt ? `https://youtube.com/shorts/${vid}` : `https://www.instagram.com/reel/${vid}/`,
    thumb: yt && past && !failed ? `https://i.ytimg.com/vi/${st.id}/hqdefault.jpg` : null,
  });
}

const queue = Array.from({ length: 30 }, (_, i) => {
  const st = streams[i % 9];
  return {
    clip_id: `${st.id}_${String(40 + i).padStart(2, "0")}`,
    creator: st.creator,
    title: pick(titles),
    score: +(9.2 - i * 0.12 - rnd() * 0.3).toFixed(1),
    audience: st.audience,
    duration_s: +(14 + rnd() * 40).toFixed(1),
    layout: rnd() < 0.7 ? "stacked" : "full",
    caption_mode: rnd() < 0.5 ? "1w" : "3w",
    fresh_h: +(rnd() * 30).toFixed(1),
    restyled: rnd() < 0.8,
    held: i === 4 || i === 17,
  };
});

const jobs = [
  ["clip_run", "Clip run", "produce", true, 4.1, "[16:58:04] round 1: 58 block(s) to process"],
  ["director", "AI director", "produce", true, 2.3, "picked 6 moments from VZqAPdUvqnQ block 14"],
  ["restyle", "Restyle (main)", "produce", true, 18.4, "rendering H-4PyJlhI9g_29 stacked 1w (pass 2/2)"],
  ["restyle_l2", "Restyle (laptop 2)", "produce", true, 0.4, "l2 job 412 done in 96 s"],
  ["seo", "SEO v3 writer", "produce", true, 1.2, "wrote titles for 12 clips"],
  ["uploader_6000", "YouTube 6000", "publish", true, 0.8, "uploaded qSyo5d-dVzA_37 (scheduled 19:20 ET)"],
  ["uploader_7000", "YouTube 7000", "publish", true, 0.6, "waiting for next slot 15:00 ET"],
  ["uploader_8000", "YouTube 8000", "publish", true, 0.3, "daily upload limit reached, sleeping"],
  ["uploader_9000", "YouTube 9000", "publish", true, 0.5, "picked HzzzoomJ-Os_36"],
  ["uploader_1000", "YouTube 1000", "publish", true, 0.2, "appeal pending, uploads paused"],
  ["uploader_2000", "YouTube 2000", "publish", false, null, "Traceback: TimeoutError: Studio upload dialog did not open in 180 s"],
  ["ig_poster", "Instagram poster", "publish", true, 1.1, "posted reel LMbea5SozeM_03 to desi.vicecity"],
  ["live_watch", "Live watcher", "support", true, 0.9, "3 live: 0C_LS2lUWdg, YylVwL4UIFU, tw2618994120"],
  ["exporter", "Dashboard exporter", "support", true, 0.3, "posted snapshot 212 KB gz"],
  ["discover", "Discovery", "research", true, 0.1, "added 2 candidates, next pass 17:30"],
  ["analytics", "Studio analytics", "research", false, null, "exited 0 (runs hourly)"],
].map(([key, name, group, running, cpu_pct, last_line], i) => ({
  key,
  name,
  group,
  running,
  pid: running ? 30000 + i * 137 : null,
  started: iso(-300 - i * 7),
  cpu_pct,
  last_line,
  last_line_at: iso(-(i % 5) - 0.5),
  errors_1h: key === "uploader_2000" ? 3 : key === "restyle" ? 1 : 0,
}));

const kinds = ["upload", "post", "fail", "discover", "render", "restyle", "error", "system"];
const evText = {
  upload: (s) => `uploaded ${s}_37 -> https://youtube.com/shorts/p-1xKDUVrJA`,
  post: (s) => `posted reel ${s}_04 -> instagram.com/reel/Df7j3yYsLkx`,
  fail: (s) => `upload failed ${s}_09: Studio dialog timeout`,
  discover: () => `discovered live: TheBurntPeanut "BUNGULATION EDITION" (41K watching)`,
  render: (s) => `rendered ${s}_22 stacked 1w in 74 s`,
  restyle: (s) => `restyled ${s}_18 (rerender queue 271)`,
  error: () => `seo: 9router returned 502, retrying in 30 s`,
  system: () => `start_gta6.ps1: CPU cap 75% holding, laptop 2 online 71 °C`,
};
const events = Array.from({ length: 80 }, (_, i) => {
  const kind = kinds[Math.floor(rnd() * (i % 7 === 0 ? 8 : 6))];
  const st = pick(streams);
  return {
    at: iso(-i * 4 - rnd() * 3),
    kind,
    source: kind === "upload" ? `uploader_${pick(ytAccounts)[0]}` : kind === "post" ? "ig_poster" : kind === "discover" ? "discover" : kind === "system" ? "supervisor" : "restyle",
    text: evText[kind](st.id),
  };
});

const snapshot = {
  schema: 1,
  generated_at: iso(-1),
  host: "main-laptop",
  system: {
    cpu_pct: 63.4,
    cpu_limit_pct: 75,
    ram_pct: 58.0,
    gpu_pct: 92,
    disk_e_free_gb: 412.3,
    laptop2: { online: true, temp_c: 78, job: "restyle_l2", last_seen: iso(-0.5) },
  },
  jobs,
  pipeline: {
    streams_tracked: 72,
    streams_live: 3,
    blocks_pending: 58,
    clips_total: 1840,
    clips_ready: 900,
    restyled: 600,
    rerender_pending: 272,
    held: 21,
    seo_v3: 700,
    reels_built: 500,
    eligible_to_upload: 140,
    uploaded_yt: 60,
    scheduled_yt: 18,
    posted_ig: 25,
  },
  streams,
  accounts,
  schedule,
  queue,
  holds: [
    { id: "8OZQzCJS52w", reason: "DrDisRespect stream taken down by a WMG copyright claim" },
    { id: "H-4PyJlhI9g_29", reason: "ad-safety (strip club)" },
    { id: "S38sFHYQNZY_01", reason: "no GTA content" },
  ],
  events,
  discovery: {
    last_run: iso(-24),
    added: [
      { id: "0C_LS2lUWdg", channel: "TheBurntPeanut", title: "🔴LIVE | GTA 6 | BUNGULATION EDITION", kind: "live", score: 861405 },
      { id: "YylVwL4UIFU", channel: "Total Gaming", title: "GTA 6 LIVE — Total Gaming in Leonida", kind: "live", score: 402113 },
    ],
    top: [
      { id: "qSyo5d-dVzA", channel: "IShowSpeed", title: "🔴PLAYING GTA 6 EARLY ACCESS GAMEPLAY GET IN HERE!", kind: "vod", watching: 0, views: 65426136 },
      { id: "LMbea5SozeM", channel: "Mythpat", title: "Welcome to Vice City!  GTA 6 LIVE with Mythpat", kind: "vod", watching: 0, views: 15992787 },
      { id: "169ZzvPxvvM", channel: "Techno Gamerz", title: "MY FIRST DAY IN VICE CITY | GTA 6 GAMEPLAY #1", kind: "vod", watching: 0, views: 14158659 },
      { id: "VZqAPdUvqnQ", channel: "Kai Cenat Live", title: "PLAYING GTA 6 FOR THE FIRST TIME (PART 1)", kind: "vod", watching: 0, views: 12077101 },
      { id: "0C_LS2lUWdg", channel: "TheBurntPeanut", title: "🔴LIVE | GTA 6 | BUNGULATION EDITION", kind: "live", watching: 41200, views: 5742714 },
    ],
  },
  research: [
    ["trends_2026-11-20", 4, "Rising: police chases with alligators fading; Jason/Lucia banter clips and 'first time in Vice City' reactions still climbing. Big-streamer reaction + physics fail is the strongest combo (avg 3.1x views vs baseline)."],
    ["music_risk_2026-11-20", 6, "216 unpublished Shorts scanned. 11 carry licensed radio tracks from in-game stations above -18 LUFS; recommend muting game audio under captions for those or holding them."],
    ["titles_2026-11-20", 3, "Creator name first + caps verb + emoji outperforms question titles by 38% on 7-day views. Avoid 'insane'/'crazy' twice in a row on one channel."],
    ["india_streams_2026-11-20", 5, "Indian GTA 6 streams peak 21:00-23:30 IST. Techno Gamerz, Mythpat and Total Gaming carry 80% of watch time; Hindi captions not needed for Hinglish audience."],
    ["qc2_2026-11-20", 8, null],
  ].map(([name, files, summary], i) => ({ name, updated: iso(-40 - i * 70), files, summary })),
  agents: [
    { name: "Music-claim risk audit", kind: "claude-subagent", task: "Scan 216 unpublished Shorts for licensed music that could trigger Content ID claims", status: "running", started: iso(-55), updated: iso(-6), output: "E:\\clipfactory\\research\\music_risk_2026-11-20" },
    { name: "Twitch VOD support", kind: "claude-subagent", task: "Add Twitch VODs/channels to the clip run (live.py)", status: "done", started: iso(-150), updated: iso(-90), output: "commit 1bb1fca" },
    { name: "Dashboard web app", kind: "claude-subagent", task: "Build + deploy the ops dashboard (Next.js on Vercel)", status: "running", started: iso(-40), updated: iso(-2), output: "C:\\Users\\shubh\\Projects\\clipping\\dashboard" },
    { name: "Title A/B review", kind: "codex", task: "Second opinion on SEO v3 title rules", status: "failed", started: iso(-200), updated: iso(-180), output: null },
    { name: "Trend scan", kind: "opencode", task: "Scrape trending GTA 6 Shorts topics", status: "done", started: iso(-320), updated: iso(-260), output: "research/trends_2026-11-20" },
  ],
  analytics: {
    updated: iso(-35),
    totals: { views: 1843200, subs: 3120, videos: 88 },
    per_account: [
      { key: "6000", views: 512000, subs: 940, videos: 14 },
      { key: "7000", views: 388100, subs: 610, videos: 11 },
      { key: "8000", views: 604300, subs: 1020, videos: 19 },
      { key: "9000", views: 201400, subs: 330, videos: 8 },
      { key: "1000", views: 84600, subs: 120, videos: 6 },
      { key: "2000", views: 52800, subs: 100, videos: 9 },
    ],
    top_videos: [
      { title: "IShowSpeed Spots A CRAZY PLANE CRASH In GTA 6 🤯", url: "https://youtube.com/shorts/SdhiI45E_u0", views: 241000, account: "8000" },
      { title: "Kai Cenat Gets ROBBED By A Gator In Vice City 😭", url: "https://youtube.com/shorts/abc", views: 133400, account: "7000" },
      { title: "CaseOh Tries To Park A Boat In GTA 6", url: "https://youtube.com/shorts/def", views: 88100, account: "9000" },
    ],
    ab: [
      { arm: "caption 1w", n: 41, avg_views: 21400 },
      { arm: "caption 3w", n: 37, avg_views: 16900 },
      { arm: "stacked facecam", n: 52, avg_views: 22800 },
      { arm: "full frame", n: 26, avg_views: 12100 },
    ],
  },
  claude: { tokens_5h: 3_100_000, tokens_today: 9_400_000, sessions_today: 14, output_tokens_today: 412_000 },
};

const empty = {
  schema: 1,
  generated_at: iso(-22),
  host: null,
  system: { cpu_pct: null, cpu_limit_pct: null, ram_pct: null, gpu_pct: null, disk_e_free_gb: null, laptop2: null },
  jobs: [],
  pipeline: null,
  streams: [],
  accounts: [],
  schedule: [],
  queue: [],
  holds: [],
  events: [],
  discovery: null,
  research: [],
  agents: [],
  analytics: null,
  claude: null,
};

mkdirSync(join(root, "fixtures"), { recursive: true });
writeFileSync(join(root, "fixtures", "sample-snapshot.json"), JSON.stringify(snapshot, null, 1));
writeFileSync(join(root, "fixtures", "empty-snapshot.json"), JSON.stringify(empty, null, 1));
console.log("wrote fixtures/sample-snapshot.json and fixtures/empty-snapshot.json");
