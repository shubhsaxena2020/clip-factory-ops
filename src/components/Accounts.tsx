"use client";

import { useMemo, useState } from "react";
import type { Account, FollowerAccount } from "@/lib/types";
import { ago, arr, compact, countdown, num } from "@/lib/format";
import { Chips, Empty, Lamp, Panel, Pill, PlatformDot, Ring, Skel, Time, useNow, type Tone } from "./ui";

// A stopped uploader only overrides the status when the status itself says nothing is wrong.
function isStopped(s?: string | null, running?: boolean | null) {
  return running === false && ["ok", "", "unknown"].includes((s ?? "").toLowerCase());
}

export function statusTone(s?: string | null, running?: boolean | null): Tone {
  if (isStopped(s, running)) return "err";
  switch ((s ?? "").toLowerCase()) {
    case "ok":
      return "ok";
    case "limit":
      return "warn";
    case "error":
      return "err";
    case "appeal":
      return "sodium";
    case "disabled":
      return "faint";
    default:
      return "faint";
  }
}

const statusText = (a: Account) =>
  isStopped(a.status, a.running) ? "stopped" : a.status === "disabled" ? "disabled (permanent)" : (a.status ?? "unknown");

/** problems first: error/stopped, then limit/appeal, then off, then ok; then by key */
function rank(a: Account) {
  const t = statusTone(a.status, a.running);
  if ((a.status ?? "") === "disabled") return 5; // permanent: nothing to act on, keep it last
  return t === "err" ? 0 : t === "warn" ? 1 : t === "sodium" ? 2 : t === "faint" ? 3 : 4;
}

function sorted(list: Account[]) {
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.platform ?? "").localeCompare(b.platform ?? "") || a.key.localeCompare(b.key));
}

function DayRing({ a }: { a: Account }) {
  const slots = arr(a.times).length || 4;
  const d = a.today;
  if (!d) return <Ring done={0} total={slots} label="no daily numbers in this snapshot" />;
  const done = d.done ?? 0;
  const booked = d.scheduled ?? 0;
  const unv = d.unverified ?? 0;
  return (
    <span className="relative inline-grid place-items-center" title={`${a.tz ?? ""} day ${d.date ?? ""}: ${done} out, ${booked} scheduled, ${unv} unverified, ${d.problem ?? 0} problems, of ${slots} slots`}>
      <Ring done={done} booked={booked} unverified={unv} total={slots} label={`${done} of ${slots} today`} />
      <span className="tnum absolute text-[0.6875rem] font-semibold">
        {done + booked}
        <span className="text-faint">/{slots}</span>
      </span>
    </span>
  );
}

// ---------- overview: compact tiles ----------

export function AccountTiles({
  accounts,
  followers,
  loading,
  onMore,
}: {
  accounts: Account[] | null | undefined;
  followers?: FollowerAccount[] | null;
  loading: boolean;
  onMore: () => void;
}) {
  const now = useNow(1000);
  const fol = arr(followers);
  const list = useMemo(() => sorted(arr(accounts)), [accounts]);
  const problems = list.filter((a) => rank(a) < 3).length;
  return (
    <Panel
      title="Today per account"
      meta={loading ? null : `problems first · ${problems} need attention · ring = today's slots (account's own day)`}
      right={
        <button type="button" onClick={onMore} className="text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">
          Details
        </button>
      }
    >
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11.875rem,1fr))] gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[4.75rem]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No accounts in this snapshot.</Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(11.875rem,1fr))] gap-2" data-testid="account-tiles">
          {list.map((a) => {
            const tone = statusTone(a.status, a.running);
            const fo = fol.find((f) => f.platform === ((a.platform ?? "") === "instagram" ? "ig" : "yt") && f.key === a.key);
            return (
              <li
                key={`${a.platform}-${a.key}`}
                className={`flex items-center gap-3 rounded-[3px] border bg-raised/50 p-2.5 ${tone === "err" ? "dead-glow border-err/50" : "border-rule"}`}
              >
                <DayRing a={a} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <PlatformDot platform={a.platform} />
                    <span className="display text-[1.375rem] font-bold leading-none">{a.key}</span>
                    <Pill tone={tone} title={a.note ?? statusText(a)}>
                      {a.status === "disabled" ? "disabled" : statusText(a)}
                    </Pill>
                    {fo?.count != null && (
                      <span className="tnum ml-auto text-[0.6875rem] text-muted" title={`${(a.platform ?? "") === "instagram" ? "followers" : "subscribers"}${fo.delta_24h != null ? `, ${fo.delta_24h >= 0 ? "+" : ""}${fo.delta_24h} since yesterday` : ""}`}>
                        {compact(fo.count)} {(a.platform ?? "") === "instagram" ? "fol." : "subs"}
                        {fo.delta_24h ? <span className={fo.delta_24h > 0 ? "text-ok" : "text-err"}> {fo.delta_24h > 0 ? "+" : ""}{fo.delta_24h}</span> : null}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[0.6875rem] text-muted" title={a.note ?? a.focus ?? undefined}>
                    {a.next_slot && tone !== "faint" && (a.status ?? "") !== "appeal" ? (
                      <>
                        next <span className="tnum font-semibold text-sodium">{countdown(a.next_slot, now)}</span>
                        {a.status === "limit" && <span className="text-warn"> · limit</span>}
                      </>
                    ) : (
                      (a.note ?? "no slot booked")
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------- publishing: full detail ----------

const PLATFORMS = ["all", "youtube", "instagram"] as const;

export function AccountDetail({ accounts, loading }: { accounts: Account[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const [pf, setPf] = useState<(typeof PLATFORMS)[number]>("all");
  const list = useMemo(() => sorted(arr(accounts)).filter((a) => pf === "all" || (a.platform ?? "") === pf), [accounts, pf]);
  return (
    <Panel
      title="Account detail"
      meta={loading ? null : "problems first"}
      right={<Chips value={pf} options={PLATFORMS} onChange={setPf} label="Filter accounts by platform" />}
    >
      {loading ? (
        <Skel className="h-[12.5rem]" />
      ) : list.length === 0 ? (
        <Empty>No accounts in this snapshot.</Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15.625rem,1fr))] gap-3">
          {list.map((a) => (
            <AccountCard key={`${a.platform}-${a.key}`} a={a} now={now} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AccountCard({ a, now }: { a: Account; now: number }) {
  const tone = statusTone(a.status, a.running);
  const d = a.today;
  const slots = arr(a.times).length || 4;
  return (
    <li className={`flex min-w-0 flex-col gap-2.5 rounded-[3px] border bg-raised/60 p-3 ${tone === "err" ? "dead-glow border-err/50" : "border-rule"}`}>
      <div className="flex items-start gap-3">
        <DayRing a={a} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="display tnum text-[1.75rem] font-bold">{a.key}</span>
            <span className="label">{a.platform === "instagram" ? "IG" : "YT"}</span>
            <span className="ml-auto">
              <Pill tone={tone} title={a.note ?? undefined}>
                <Lamp tone={tone} />
                {statusText(a)}
              </Pill>
            </span>
          </div>
          <div className="truncate text-[0.75rem] text-muted" title={a.name ?? undefined}>
            {a.name ?? "unnamed channel"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]">
        <span className="text-ink" title={a.focus_raw ? `filter: ${a.focus_raw.join(", ")}` : undefined}>
          {a.focus ?? "Any streamer"}
        </span>
        {a.audience && <span className="rounded-[2px] bg-rule px-1.5 text-[0.65625rem] font-semibold text-muted">{a.audience}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.71875rem]">
        <dt className="text-faint">Today ({a.tz?.split("/")[1]?.replace("_", " ") ?? "local"})</dt>
        <dd className="tnum text-right">
          {d ? (
            <>
              <span className="text-ok">{d.done ?? 0} out</span> · <span>{d.scheduled ?? 0} sched</span>
              {(d.unverified ?? 0) > 0 && <span className="text-faint"> · {d.unverified} unver.</span>}
              {(d.problem ?? 0) > 0 && <span className="text-err"> · {d.problem} bad</span>}
              <span className="text-faint"> / {slots}</span>
            </>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-faint" title="by upload / post time, not publish time">{a.platform === "instagram" ? "Posts" : "Uploads"}, last 24 h</dt>
        <dd className="tnum text-right">{num(a.uploads_24h)}</dd>
        <dt className="text-faint">{a.platform === "instagram" ? "Total posted" : "Total uploaded"}</dt>
        <dd className="tnum text-right">{num(a.uploads_total)}</dd>
        <dt className="text-faint">Slots ({a.tz ?? "—"})</dt>
        <dd className="tnum truncate text-right">{arr(a.times).join(" ")}</dd>
      </dl>
      <div className="flex items-end justify-between gap-2 border-t border-rule pt-2 text-[0.75rem]">
        <span className="label pb-[1px]">Next free slot</span>
        {a.next_slot && a.status !== "appeal" && a.status !== "disabled" ? (
          <span className="flex flex-col items-end leading-tight">
            <span className="tnum text-[0.875rem] font-semibold text-sodium">{countdown(a.next_slot, now)}</span>
            <Time iso={a.next_slot} className="text-[0.6875rem] text-faint" />
            {a.status === "limit" && <span className="text-[0.65625rem] text-warn">blocked until the upload limit clears</span>}
          </span>
        ) : (
          <span className="text-right text-faint">{a.note ?? "none booked"}</span>
        )}
      </div>
      <div className="min-h-[2.125rem] text-[0.71875rem] leading-snug">
        {a.last_event ? (
          <>
            <p className="line-clamp-2 break-words text-muted" title={a.last_event}>
              {a.last_event}
            </p>
            <p className="mt-0.5 text-faint">{ago(a.last_event_at, now)}</p>
          </>
        ) : (
          <p className="text-faint">No events yet.</p>
        )}
      </div>
    </li>
  );
}
