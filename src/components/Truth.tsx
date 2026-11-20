"use client";

import { useEffect, useRef, useState } from "react";
import type { Truth, TruthCheck } from "@/lib/types";
import { clock, dur, toMs } from "@/lib/format";
import { Lamp, useZone, type Tone } from "./ui";

const OVERDUE_MS = 25 * 60_000; // the self-check runs every 10 min

function show(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

/** "data verified hh:mm ✓ / N mismatches": the self-check (clipper.dashboard_truth) recomputes every
 *  number from the raw files every 10 min; the drill-down lists each check. */
export function TruthBadge({ truth, now }: { truth: Truth | null | undefined; now: number }) {
  const { zone } = useZone();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const at = toMs(truth?.at);
  const fails = truth?.n_fail ?? 0;
  const overdue = at == null || now - at > OVERDUE_MS;
  let tone: Tone = "faint";
  let text = "data not verified yet";
  if (truth && at != null) {
    if (fails > 0) {
      tone = "err";
      text = `${fails} mismatch${fails === 1 ? "" : "es"} · ${clock(at, zone, false)}`;
    } else {
      tone = overdue ? "warn" : "ok";
      text = `data verified ${clock(at, zone, false)} ✓${overdue ? " (overdue)" : ""}`;
    }
  }
  const rows: TruthCheck[] = [...(truth?.checks ?? [])].sort(
    (a, b) => (a.ok === false ? 0 : a.ok == null ? 1 : 2) - (b.ok === false ? 0 : b.ok == null ? 1 : 2),
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        data-testid="truth-badge"
        data-fails={fails}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Every number recomputed from the raw files, logs, processes and laptop 2 by the self-check job, every 10 min"
        className={`flex items-center gap-2 rounded-[3px] border px-2 py-1 text-[0.6875rem] font-semibold tracking-[0.04em] ${
          tone === "err" ? "border-err/55 bg-err/10 text-err" : tone === "ok" ? "border-ok/45 text-ok" : tone === "warn" ? "border-warn/45 text-warn" : "border-rule-strong text-faint"
        }`}
      >
        <Lamp tone={tone} />
        <span className="tnum">{text}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Self-check results"
          className="absolute left-0 top-full z-40 mt-2 w-[min(46rem,calc(100vw-2rem))] rounded-[3px] border border-rule-strong bg-panel shadow-2xl"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-3 py-2 text-[0.6875rem]">
            <span className="label !text-ink">Self-check</span>
            {truth ? (
              <span className="text-muted">
                {truth.n_checks ?? 0} checks · <span className={fails ? "text-err" : "text-ok"}>{fails} mismatches</span> ·{" "}
                {truth.n_skip ?? 0} skipped · ran {at != null ? `${dur(now - at)} ago` : "—"}
                {truth.error ? <span className="text-err"> · {truth.error}</span> : null}
              </span>
            ) : (
              <span className="text-muted">The self-check job has not reported yet (it runs every 10 min).</span>
            )}
            <button type="button" onClick={() => setOpen(false)} className="ml-auto text-muted hover:text-ink">
              close
            </button>
          </div>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-[0.6875rem]">
              <thead className="sticky top-0 bg-panel text-faint">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Check</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Truth</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Shown</th>
                  <th className="hidden px-3 py-1.5 font-semibold sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-rule/60 align-top">
                    <td className="px-3 py-1">
                      <span className="flex items-center gap-1.5">
                        <Lamp tone={r.ok === false ? "err" : r.ok == null ? "faint" : "ok"} />
                        <span className={r.ok === false ? "font-semibold text-err" : "text-ink"}>{r.label}</span>
                      </span>
                      <span className="block pl-3.5 text-faint">
                        {r.page}
                        {r.note ? ` · ${r.note}` : ""}
                      </span>
                    </td>
                    <td className="tnum px-2 py-1 text-right">{show(r.expected)}</td>
                    <td className={`tnum px-2 py-1 text-right ${r.ok === false ? "text-err" : ""}`}>
                      {show(r.shown)}
                      {r.tol ? <span className="block text-faint">±{r.tol}</span> : null}
                    </td>
                    <td className="hidden px-3 py-1 text-faint sm:table-cell">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
