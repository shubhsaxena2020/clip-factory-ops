"use client";

import type { Hold, QueueItem } from "@/lib/types";
import { arr, num } from "@/lib/format";
import { Empty, Panel, Pill, Skel, useShowMore } from "./ui";

export function Queue({ queue, loading }: { queue: QueueItem[] | null | undefined; loading: boolean }) {
  const list = arr(queue);
  const maxScore = Math.max(10, ...list.map((q) => q.score ?? 0));
  const { shown, toggle } = useShowMore(list, 10);
  return (
    <Panel title="Upload queue" meta={loading ? null : `next ${list.length} clips the uploaders will pick, by score (best first)`} bodyClass="p-0">
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skel key={i} className="h-9" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="p-4">
          <Empty>The queue is empty. Clips appear here once they are restyled, have SEO v3 and pass the upload gate.</Empty>
        </div>
      ) : (
        <>
        <ol className="divide-y divide-rule md:hidden">
          {shown.map((q, i) => (
            <li key={`${q.clip_id}-${i}`} className={`grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 px-4 py-2.5 ${q.held ? "opacity-60" : ""}`}>
              <span className="tnum pt-0.5 text-[0.6875rem] text-faint">{i + 1}</span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[0.78125rem] text-ink">{q.title ?? "untitled"}</p>
                <p className="mt-0.5 truncate text-[0.6875rem] text-faint">
                  <span className="text-muted">{q.creator ?? "—"}</span> {q.audience ?? ""} {q.clip_id}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
                  <span className="tnum font-semibold text-sodium">{num(q.score, 1)}</span>
                  <span className={`tnum ${q.fresh_h != null && q.fresh_h > 24 ? "text-warn" : "text-muted"}`}>
                    {q.fresh_h == null ? "—" : `${q.fresh_h.toFixed(1)} h old`}
                  </span>
                  {q.held ? <Pill tone="err">held</Pill> : null}
                  {q.restyled === false ? <Pill tone="warn">needs restyle</Pill> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="scroll-thin hidden overflow-x-auto md:block">
          <table className="w-full min-w-[47.5rem] border-collapse text-left text-[0.75rem]">
            <thead>
              <tr className="border-b border-rule">
                {["#", "Clip", "Score", "Fresh", "Format", "State"].map((h) => (
                  <th key={h} scope="col" className="label px-3 py-2 font-normal first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((q, i) => (
                <tr key={`${q.clip_id}-${i}`} className={`border-b border-rule/70 ${q.held ? "opacity-60" : ""}`}>
                  <td className="tnum px-3 py-2 pl-4 text-faint">{i + 1}</td>
                  <td className="max-w-[26.25rem] px-3 py-2">
                    <div className="truncate text-ink" title={q.title ?? undefined}>
                      {q.title ?? "untitled"}
                    </div>
                    <div className="flex gap-2 text-[0.6875rem] text-faint">
                      <span className="text-muted">{q.creator ?? "—"}</span>
                      {q.audience && <span>{q.audience}</span>}
                      <span className="truncate">{q.clip_id}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="tnum w-7 font-semibold text-sodium">{num(q.score, 1)}</span>
                      <span className="block h-[0.3125rem] w-20 bg-rule-strong/70">
                        <span className="block h-full bg-sodium" style={{ width: `${Math.max(0, Math.min(1, (q.score ?? 0) / maxScore)) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className={`tnum px-3 py-2 ${q.fresh_h != null && q.fresh_h > 24 ? "text-warn" : "text-muted"}`}>
                    {q.fresh_h == null ? "—" : `${q.fresh_h.toFixed(1)} h`}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {[q.layout, q.caption_mode && `cap ${q.caption_mode}`, q.duration_s != null && `${Math.round(q.duration_s)} s`]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {q.held ? <Pill tone="err">held</Pill> : null}
                      {q.restyled === false ? <Pill tone="warn">needs restyle</Pill> : q.restyled ? <Pill tone="ok">restyled</Pill> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">{toggle}</div>
        </>
      )}
    </Panel>
  );
}

export function Holds({ holds, held, loading }: { holds: Hold[] | null | undefined; held: number | null | undefined; loading: boolean }) {
  const list = arr(holds);
  return (
    <Panel
      title="Held back"
      meta={loading ? null : `${list.length} hold.json entries (a clip or a whole stream) · ${num(held)} ready clips held by them`}
    >
      {loading ? (
        <Skel className="h-[12.5rem]" />
      ) : list.length === 0 ? (
        <Empty>Nothing is on hold.</Empty>
      ) : (
        <ul className="scroll-thin flex max-h-[40rem] flex-col divide-y divide-rule overflow-y-auto">
          {list.map((h, i) => (
            <li key={`${h.id}-${i}`} className="py-2">
              <div className="tnum text-[0.75rem] font-semibold text-ink">{h.id}</div>
              <div className="text-[0.75rem] text-muted">{h.reason ?? "no reason given"}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
