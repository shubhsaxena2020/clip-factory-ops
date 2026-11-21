"use client";

import { useMemo } from "react";
import type { Account, FollowerAccount, HoldsBreakdown, Pipeline, RenderJob, Snapshot } from "@/lib/types";
import { ago, arr, compact, countdown, num, toMs } from "@/lib/format";
import { ACTIVE_STAGES, activeRenders, rowState, type LiveMeta } from "@/lib/derive";
import { statusTone } from "./Accounts";
import { Empty, ExtLink, Lamp, Panel, PlatformDot, Skel, Time, useNow, type Tone } from "./ui";
import type { TabKey } from "./Header";

// ---------- needs attention: every current problem, worst first ----------

interface Issue {
  key: string;
  tone: Tone;
  title: string;
  detail?: string | null;
  tab?: TabKey;
}

function issues(s: (Snapshot & { live_meta?: LiveMeta }) | null, now: number): Issue[] {
  if (!s) return [];
  const out: Issue[] = [];
  const cpu = s.system?.cpu_pct;
  const limit = s.system?.cpu_limit_pct ?? 75;
  const mainAt = s.live_meta?.mainAt;
  if (cpu != null && cpu > limit && mainAt != null && now - mainAt < 60_000)
    out.push({ key: "cpu", tone: "err", title: `Main laptop CPU ${Math.round(cpu)}%, over the ${limit}% cap`, detail: "Task Manager's reading, live", tab: "production" });
  const l2 = s.system?.laptop2;
  const t2 = s.machines?.laptop2?.load?.temp_c;
  if (l2?.online === false) out.push({ key: "l2off", tone: "warn", title: "Laptop 2 is offline", detail: `last seen ${ago(l2.last_seen, now)}; renders wait or run on the main laptop's lane`, tab: "production" });
  else if (t2 != null && t2 >= 85) out.push({ key: "l2hot", tone: "warn", title: `Laptop 2 at ${t2}°C`, detail: "the slot rule allows no new render above 85°C", tab: "production" });
  const tr = s.truth;
  if (tr && (tr.n_fail ?? 0) > 0) out.push({ key: "truth", tone: "warn", title: `${tr.n_fail} dashboard number(s) differ from the raw files`, detail: "the self-check badge in the header lists each one" });
  for (const j of arr(s.jobs)) {
    if (j.state === "stopped") out.push({ key: `job-${j.key}`, tone: "err", title: `${j.name ?? j.key} is not running`, detail: j.last_line, tab: "production" });
    else if ((j.errors_1h ?? 0) > 0) out.push({ key: `jerr-${j.key}`, tone: "warn", title: `${j.name ?? j.key}: ${j.errors_1h} error line(s) in the last hour`, detail: j.last_line, tab: "production" });
  }
  for (const a of arr(s.accounts)) {
    const st = (a.status ?? "").toLowerCase();
    const yt = (a.platform ?? "") !== "instagram";
    const name = `${yt ? "YT" : "IG"} ${a.key}`;
    if (st === "disabled") continue;
    if (statusTone(a.status, a.running) === "err")
      out.push({ key: `acc-${a.platform}-${a.key}`, tone: "err", title: `${name}: ${a.running === false && st === "ok" ? "poster stopped" : (a.note ?? st)}`, detail: a.last_event, tab: "publishing" });
    else if (st === "limit" || st === "appeal")
      out.push({ key: `acc-${a.platform}-${a.key}`, tone: "warn", title: `${name}: ${a.note ?? st}`, detail: a.next_slot ? `next slot ${countdown(a.next_slot, now)}` : a.last_event, tab: "publishing" });
  }
  const gone = new Set(arr(s.accounts).filter((a) => (a.status ?? "") === "disabled").map((a) => `${a.platform}:${a.key}`));
  const bad = arr(s.schedule).filter((i) => ["failed", "problem"].includes(rowState(i)) && !gone.has(`${i.platform}:${i.account}`));
  if (bad.length)
    out.push({ key: "sched-bad", tone: "err", title: `${bad.length} post(s) failed or not public`, detail: bad.slice(0, 3).map((i) => `${(i.platform ?? "") === "instagram" ? "IG" : "YT"} ${i.account} ${i.clip_id}`).join(" · "), tab: "publishing" });
  const awaiting = s.kpis?.posted_today?.awaiting_check ?? 0;
  if (awaiting > 0) out.push({ key: "awaiting", tone: "faint", title: `${awaiting} Short(s) past their slot, not confirmed public yet`, detail: "the public check runs every 20 min", tab: "publishing" });
  const p = s.pipeline;
  if (p?.creation_paused) out.push({ key: "paused", tone: "faint", title: "Clip run and discovery are paused", detail: "state\\creation_paused exists (delete it to resume new clips)" });
  if ((p?.eligible_to_upload ?? 1) === 0) out.push({ key: "empty-q", tone: "warn", title: "Upload queue is empty", detail: "no clip passes the uploaders' gate right now", tab: "publishing" });
  const rank: Record<string, number> = { err: 0, warn: 1, sodium: 2, faint: 3 };
  return out.sort((a, b) => (rank[a.tone] ?? 4) - (rank[b.tone] ?? 4));
}

export function Attention({ s, loading, onTab }: { s: (Snapshot & { live_meta?: LiveMeta }) | null; loading: boolean; onTab: (t: TabKey) => void }) {
  const now = useNow(5000);
  const list = useMemo(() => issues(s, now), [s, now]);
  const serious = list.filter((i) => i.tone === "err" || i.tone === "warn").length;
  return (
    <Panel title="Needs attention" meta={loading ? null : serious ? `${serious} problem${serious === 1 ? "" : "s"}, worst first` : "nothing is wrong right now"} bodyClass="px-4 py-2" className="h-full">
      {loading ? (
        <Skel className="my-2 h-[10rem]" />
      ) : list.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-[0.75rem] text-ok">
          <Lamp tone="ok" /> All clear: every job runs, no post failed, CPU under the cap.
        </div>
      ) : (
        <ul className="divide-y divide-rule" data-testid="attention">
          {list.slice(0, 9).map((i) => (
            <li key={i.key} className="flex items-start gap-2.5 py-2">
              <span className="pt-[0.35rem]">
                <Lamp tone={i.tone} pulse={i.tone === "err"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[0.75rem] font-semibold ${i.tone === "err" ? "text-err" : i.tone === "warn" ? "text-warn" : "text-ink"}`}>{i.title}</p>
                {i.detail && <p className="truncate text-[0.6875rem] text-faint" title={i.detail}>{i.detail}</p>}
              </div>
              {i.tab && (
                <button type="button" onClick={() => onTab(i.tab!)} className="shrink-0 pt-0.5 text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">
                  {i.tab}
                </button>
              )}
            </li>
          ))}
          {list.length > 9 && <li className="py-2 text-[0.6875rem] text-faint">+{list.length - 9} more</li>}
        </ul>
      )}
    </Panel>
  );
}

// ---------- per-account health: one row per account ----------

function followerOf(f: FollowerAccount[], a: Account) {
  const p = (a.platform ?? "") === "instagram" ? "ig" : "yt";
  return f.find((x) => x.platform === p && x.key === a.key) ?? null;
}

export function Delta({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-faint">—</span>;
  const tone = v > 0 ? "text-ok" : v < 0 ? "text-err" : "text-faint";
  return <span className={`tnum ${tone}`}>{v > 0 ? `+${num(v)}` : v === 0 ? "±0" : num(v)}</span>;
}

function healthOf(a: Account, now: number): { tone: Tone; text: string } {
  const st = (a.status ?? "").toLowerCase();
  if (st === "disabled") return { tone: "faint", text: "disabled for good" };
  const t = statusTone(a.status, a.running);
  if (t === "err") return { tone: "err", text: a.running === false && st === "ok" ? "poster stopped" : (a.note ?? "error") };
  if (st === "limit") return { tone: "warn", text: a.note ?? "upload limit" };
  if (st === "appeal") return { tone: "sodium", text: a.note ?? "appeal" };
  if (st === "off") return { tone: "faint", text: "uploads off" };
  const last = toMs(a.last_event_at);
  if (last != null && now - last > 26 * 3600_000) return { tone: "warn", text: "quiet for over a day" };
  return { tone: "ok", text: "healthy" };
}

export function AccountHealth({ accounts, followers, loading }: { accounts: Account[] | null | undefined; followers: FollowerAccount[] | null | undefined; loading: boolean }) {
  const now = useNow(5000);
  const f = arr(followers);
  const rows = useMemo(() => {
    const rank: Record<string, number> = { err: 0, warn: 1, sodium: 2, ok: 3, faint: 4 };
    return arr(accounts)
      .map((a) => ({ a, h: healthOf(a, now), fo: followerOf(f, a) }))
      .sort((x, y) => (rank[x.h.tone] ?? 5) - (rank[y.h.tone] ?? 5) || (x.a.platform ?? "").localeCompare(y.a.platform ?? "") || x.a.key.localeCompare(y.a.key));
  }, [accounts, f, now]);
  return (
    <Panel title="Account health" meta={loading ? null : "every channel and page, problems first · today = the account's own calendar day"} bodyClass="p-0">
      {loading ? (
        <div className="p-4">
          <Skel className="h-[14rem]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <Empty>No accounts in this snapshot.</Empty>
        </div>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[0.75rem]" data-testid="account-health">
            <thead>
              <tr className="border-b border-rule">
                {["Account", "Health", "Audience", "Today", "24 h", "Next slot", "Last event"].map((h) => (
                  <th key={h} scope="col" className="label px-3 py-2 font-normal first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, h, fo }) => {
                const d = a.today;
                const slots = arr(a.times).length || 4;
                const ig = (a.platform ?? "") === "instagram";
                return (
                  <tr key={`${a.platform}-${a.key}`} className={`border-b border-rule/60 last:border-b-0 ${h.tone === "faint" ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 pl-4">
                      <span className="flex items-center gap-1.5">
                        <PlatformDot platform={a.platform} />
                        <span className="text-[0.65625rem] font-semibold text-muted">{ig ? "IG" : "YT"}</span>
                        <span className="tnum font-semibold">{a.key}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5" title={a.note ?? undefined}>
                        <Lamp tone={h.tone} />
                        <span className={h.tone === "err" ? "text-err" : h.tone === "warn" ? "text-warn" : h.tone === "ok" ? "text-ink" : "text-muted"}>{h.text}</span>
                      </span>
                    </td>
                    <td className="tnum px-3 py-2" title={fo?.error ?? fo?.note ?? undefined}>
                      {fo?.count != null ? (
                        <>
                          <ExtLink href={fo.url}>{compact(fo.count)}</ExtLink>
                          <span className="text-faint"> {ig ? "followers" : "subs"} </span>
                          <Delta v={fo.delta_24h} />
                        </>
                      ) : (
                        <span className="text-faint">{fo?.status === "disabled" ? "—" : fo?.status === "blocked" ? "IG blocks reads" : "not read yet"}</span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2">
                      {d ? (
                        <>
                          <span className="text-ok">{d.done ?? 0}</span>
                          <span className="text-faint"> out · </span>
                          {d.scheduled ?? 0}
                          <span className="text-faint"> booked / {slots}</span>
                          {(d.problem ?? 0) > 0 && <span className="text-err"> · {d.problem} bad</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="tnum px-3 py-2" title={ig ? "posts in the last 24 h" : "uploads in the last 24 h (by upload time)"}>
                      {num(a.uploads_24h)}
                    </td>
                    <td className="tnum px-3 py-2">
                      {a.next_slot && h.tone !== "faint" ? (
                        <span title={a.next_slot}>
                          <span className="font-semibold text-sodium">{countdown(a.next_slot, now)}</span> <Time iso={a.next_slot} className="text-faint" />
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="max-w-[18rem] px-3 py-2">
                      <span className="block truncate text-muted" title={a.last_event ?? undefined}>
                        {a.last_event ?? "—"}
                      </span>
                      {a.last_event_at && <span className="text-[0.6875rem] text-faint">{ago(a.last_event_at, now)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- why clips are held back ----------

function Bars({ rows, total, tone = "bg-sodium" }: { rows: { label: string; n: number; title?: string }[]; total: number; tone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.5rem] items-center gap-2 text-[0.71875rem]" title={r.title}>
          <span className="truncate text-ink">{r.label}</span>
          <span className="block h-[0.375rem] bg-rule-strong/60">
            <span className={`grow-bar block h-full ${tone}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="tnum text-right text-muted" title={total ? `${Math.round((r.n / total) * 100)}%` : undefined}>
            {r.n}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function HoldReasons({ hb, held, loading }: { hb: HoldsBreakdown | null | undefined; held: number | null | undefined; loading: boolean }) {
  const cats = arr(hb?.categories);
  const qc = hb?.visual_qc;
  return (
    <Panel title="Why clips are held back" meta={loading ? null : `${num(hb?.entries)} hold.json entries · ${num(held)} ready clips held · plus the visual QC gate`}>
      {loading ? (
        <Skel className="h-[14rem]" />
      ) : !hb ? (
        <Empty>No breakdown in this snapshot yet: the exporter adds it on its next pass after the update.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="label mb-2">hold.json, by reason</h4>
            {cats.length === 0 ? (
              <p className="text-[0.75rem] text-faint">Nothing is on hold.</p>
            ) : (
              <Bars
                total={hb.entries ?? 0}
                rows={cats.map((c) => ({
                  label: c.label,
                  n: c.n,
                  title: `${c.n} entries${c.streams ? ` (${c.streams} whole stream${c.streams === 1 ? "" : "s"})` : ""}: ${arr(c.examples).map((e) => `${e.id}: ${e.reason}`).join(" | ")}`,
                }))}
              />
            )}
          </div>
          {qc && (
            <div>
              <h4 className="label mb-2 flex flex-wrap items-baseline gap-x-2">
                Visual QC, newest verdict per clip
                <span className="normal-case tracking-normal text-faint">
                  {num(qc.checked)} checked · <span className="text-ok">{num(qc.passed)} pass</span> · <span className="text-err">{num(qc.failed)} fail</span>
                  {qc.last ? <> · last <Time iso={qc.last} /></> : null}
                </span>
              </h4>
              {arr(qc.reasons).length ? <Bars rows={arr(qc.reasons)} total={qc.failed ?? 0} tone="bg-err/80" /> : <p className="text-[0.75rem] text-faint">No failures.</p>}
              {arr(qc.notes).length > 0 && (
                <p className="mt-2 text-[0.6875rem] text-faint">
                  Passed with a note: {arr(qc.notes).map((n) => `${n.label} ${n.n}`).join(" · ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------- render split: laptop 2 vs the main laptop ----------

export function RenderSplit({ s, loading }: { s: Snapshot | null; loading: boolean }) {
  const now = useNow(5000);
  const l2 = s?.machines?.laptop2;
  const renders = arr(l2?.renders);
  const active = l2?.active ?? activeRenders(renders);
  const main = s?.render_split?.main;
  const mainN = main?.busy ? 1 : 0;
  const total = active + mainN;
  const p: Pipeline = s?.pipeline ?? {};
  const byPath = useMemo(() => {
    const m = new Map<string, { active: number; done: number; failed: number }>();
    for (const r of renders) {
      const k = r.path ?? "other";
      const c = m.get(k) ?? { active: 0, done: 0, failed: 0 };
      if (ACTIVE_STAGES.includes(r.stage ?? "")) c.active += 1;
      else if (r.stage === "done") c.done += 1;
      else if (r.stage === "failed") c.failed += 1;
      m.set(k, c);
    }
    return [...m.entries()];
  }, [renders]);
  const done6 = renders.filter((r: RenderJob) => r.stage === "done").length;
  const slots = l2?.slots;
  return (
    <Panel title="Render split" meta={loading ? null : "where Shorts are rendered right now: laptop 2 (x264) or the main laptop's GPU lane"}>
      {loading ? (
        <Skel className="h-[9rem]" />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex h-6 overflow-hidden rounded-[2px] border border-rule bg-raised" role="img" aria-label={`${active} on laptop 2, ${mainN} on the main laptop`}>
              {total === 0 ? (
                <span className="m-auto text-[0.6875rem] text-faint">no render running</span>
              ) : (
                <>
                  {active > 0 && (
                    <span className="grid place-items-center bg-sodium text-[0.6875rem] font-semibold text-[#1a0d04]" style={{ width: `${(active / total) * 100}%` }}>
                      laptop 2 · {active}
                    </span>
                  )}
                  {mainN > 0 && (
                    <span className="grid place-items-center bg-[#6aa9ff] text-[0.6875rem] font-semibold text-[#06101f]" style={{ width: `${(mainN / total) * 100}%` }}>
                      main · {mainN}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 text-[0.75rem]">
              <h4 className="label flex items-center gap-2">
                <Lamp tone={l2?.online === false ? "faint" : active ? "sodium" : "ok"} /> Laptop 2
              </h4>
              <p>
                <span className="tnum font-semibold text-ink">{active}</span> running · slots allowed{" "}
                <span className="tnum font-semibold">{slots?.capacity ?? "—"}</span>
                {slots?.hot ? <span className="text-warn"> (hot)</span> : null}
              </p>
              {byPath.length === 0 ? (
                <p className="text-faint">No render jobs in the last 6 h.</p>
              ) : (
                <ul className="text-[0.71875rem] text-muted">
                  {byPath.map(([k, c]) => (
                    <li key={k} className="tnum">
                      <span className="text-ink">{k}</span>: {c.active} running · {c.done} done · {c.failed ? <span className="text-err">{c.failed} failed</span> : "0 failed"}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[0.6875rem] text-faint">{done6} finished in the last 6 h</p>
            </div>
            <div className="flex flex-col gap-1.5 text-[0.75rem]">
              <h4 className="label flex items-center gap-2">
                <Lamp tone={main?.busy ? "sodium" : "ok"} /> Main laptop
              </h4>
              {main ? (
                <>
                  <p>
                    {main.busy ? (
                      <>
                        <span className="font-semibold text-ink">1 rendering</span>
                        {main.since ? <span className="text-faint"> · since {ago(main.since, now)}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted">lane idle</span>
                    )}
                    <span className="text-faint"> · {num(main.ffmpeg)} ffmpeg process{main.ffmpeg === 1 ? "" : "es"} on the machine</span>
                  </p>
                  <p className="text-[0.6875rem] text-faint">{main.lane ?? "one local render at a time"}</p>
                </>
              ) : (
                <p className="text-faint">No main-laptop lane data in this snapshot yet.</p>
              )}
            </div>
          </div>
          <p className="border-t border-rule pt-2 text-[0.71875rem] text-muted">
            Waiting for a render: <span className="tnum font-semibold text-sodium">{num(p.rerender_pending)}</span> ready clips the upload gate holds until re-rendered
            {(p.rerender_lost ?? 0) > 0 ? <span className="text-faint"> · {num(p.rerender_lost)} cannot be re-rendered</span> : null}
            {arr(slots?.held).length ? <span className="text-faint"> · slots held by {arr(slots?.held).map((h) => `${h.owner ?? "?"} ${h.clip ?? ""}`).join(", ")}</span> : null}
          </p>
        </div>
      )}
    </Panel>
  );
}
