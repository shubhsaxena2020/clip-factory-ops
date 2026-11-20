"use client";

import type { Account } from "@/lib/types";
import { ago, arr, countdown, num } from "@/lib/format";
import { Empty, Lamp, Panel, Pill, PlatformDot, Skel, Time, useNow, type Tone } from "./ui";

const DAILY_CAP = 4;

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
    case "off":
      return "faint";
    default:
      return "faint";
  }
}

export function Accounts({ accounts, loading }: { accounts: Account[] | null | undefined; loading: boolean }) {
  const now = useNow(1000);
  const list = arr(accounts);
  const yt = list.filter((a) => (a.platform ?? "").toLowerCase() === "youtube");
  const ig = list.filter((a) => (a.platform ?? "").toLowerCase() === "instagram");
  const other = list.filter((a) => !["youtube", "instagram"].includes((a.platform ?? "").toLowerCase()));
  const problems = list.filter((a) => ["error", "appeal", "limit"].includes((a.status ?? "").toLowerCase())).length;

  return (
    <Panel
      title="Accounts"
      meta={loading ? null : `${yt.length} YouTube, ${ig.length} Instagram${problems ? `, ${problems} need attention` : ""}`}
    >
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[168px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty>No accounts in this snapshot. Uploader and poster status appears here once the exporter reports them.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {[
            ["YouTube", yt],
            ["Instagram", ig],
            ["Other", other],
          ].map(([name, group]) =>
            (group as Account[]).length ? (
              <div key={name as string}>
                <h3 className="label mb-2 flex items-center gap-2">
                  <PlatformDot platform={(name as string).toLowerCase()} />
                  {name as string}
                </h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                  {(group as Account[]).map((a) => (
                    <AccountCard key={`${a.platform}-${a.key}`} a={a} now={now} />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}
    </Panel>
  );
}

function AccountCard({ a, now }: { a: Account; now: number }) {
  const tone = statusTone(a.status, a.running);
  const today = a.uploads_today ?? null;
  const status = isStopped(a.status, a.running) ? "stopped" : (a.status ?? "unknown");
  return (
    <li
      className={`flex min-w-0 flex-col gap-3 rounded-[3px] border bg-raised/60 p-3 ${
        tone === "err" ? "dead-glow border-err/50" : "border-rule"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="display tnum text-[30px] font-bold">{a.key}</span>
            <span className="label">{a.platform === "instagram" ? "IG" : "YT"}</span>
          </div>
          <div className="truncate text-[12px] text-muted" title={a.name ?? undefined}>
            {a.name ?? "unnamed channel"}
          </div>
        </div>
        <Pill tone={tone} title={a.note ?? undefined}>
          <Lamp tone={tone} />
          {status}
        </Pill>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="text-ink">{a.focus ?? "no focus streamer"}</span>
        {a.audience && <span className="rounded-[2px] bg-rule px-1.5 text-[10.5px] font-semibold text-muted">{a.audience}</span>}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">Today</span>
          <span className="tnum text-[12px]">
            <span className="font-semibold text-ink">{num(today)}</span>
            <span className="text-faint"> / {DAILY_CAP}</span>
            <span className="text-faint"> · {num(a.uploads_total)} total</span>
          </span>
        </div>
        <div className="flex gap-1" role="meter" aria-label="Uploads today" aria-valuemin={0} aria-valuemax={DAILY_CAP} aria-valuenow={today ?? undefined}>
          {Array.from({ length: DAILY_CAP }, (_, i) => (
            <span key={i} className={`h-[6px] flex-1 rounded-[1px] ${today != null && i < today ? "bg-sodium" : "bg-rule-strong/70"}`} />
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 text-[12px]">
        <span className="label pb-[1px]">Next slot</span>
        {a.next_slot ? (
          <span className="flex flex-col items-end leading-tight">
            <span className="tnum text-[14px] font-semibold text-sodium">{countdown(a.next_slot, now)}</span>
            <Time iso={a.next_slot} className="text-[11px] text-faint" />
          </span>
        ) : (
          <span className="text-right text-faint">{a.note ?? "none booked"}</span>
        )}
      </div>

      <div className="min-h-[34px] border-t border-rule pt-2 text-[11.5px] leading-snug">
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
