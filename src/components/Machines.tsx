"use client";

import type { DockerStatus, L2Slots, Machine, RenderJob, Snapshot } from "@/lib/types";
import { arr, dur, num, toMs } from "@/lib/format";
import { ACTIVE_STAGES, type LiveMeta } from "@/lib/derive";
import { Age, Empty, Lamp, Panel, Pill, Skel, TickMeter, pctText, useNow, useShowMore, type Tone } from "./ui";

type S = (Snapshot & { live_meta?: LiveMeta }) | null;

function rate(bps: number | null | undefined) {
  if (bps == null) return "—";
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function tempTone(t?: number | null): Tone {
  return t == null ? "faint" : t >= 85 ? "err" : t >= 78 ? "warn" : "ok";
}

function machineList(s: S) {
  const m = s?.machines ?? {};
  const l2on = s?.system?.laptop2?.online !== false;
  const meta = s?.live_meta;
  return [
    { key: "main", name: "Main laptop", m: m.main ?? null, online: true, limit: s?.system?.cpu_limit_pct ?? 75, at: meta?.mainAt ?? toMs(m.main?.at), src: meta?.mainSrc },
    { key: "laptop2", name: "Laptop 2", m: m.laptop2 ?? null, online: l2on, limit: null as number | null, at: meta?.l2At ?? toMs(m.laptop2?.at), src: meta?.l2Src },
  ];
}

/** busy cores = CPU % x hardware threads: comparable across the two very different machines */
function busyCores(m: Machine | null, online: boolean) {
  const cpu = online ? m?.load?.cpu : null;
  const th = m?.specs?.threads;
  return cpu != null && th ? (cpu / 100) * th : null;
}

export function LoadSplit({ s, loading, onMore }: { s: S; loading: boolean; onMore: () => void }) {
  const now = useNow(1000);
  const ms = machineList(s);
  const a = busyCores(ms[0].m, true);
  const b = busyCores(ms[1].m, ms[1].online);
  const tot = (a ?? 0) + (b ?? 0);
  return (
    <Panel
      title="Load split, both laptops"
      meta={loading ? null : "busy cores = CPU % x hardware threads (all processes)"}
      right={
        <button type="button" onClick={onMore} className="text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">
          Machines
        </button>
      }
    >
      {loading ? (
        <Skel className="h-[6.875rem]" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex h-[1.375rem] overflow-hidden rounded-[2px] bg-rule-strong/60" role="img" aria-label="share of busy cores per laptop">
            {tot > 0 && (
              <>
                <span className="grow-bar grid place-items-center bg-sodium text-[0.625rem] font-bold text-[#1a0d04]" style={{ width: `${((a ?? 0) / tot) * 100}%` }}>
                  {a != null && a / tot > 0.15 ? `main ${a.toFixed(1)}` : ""}
                </span>
                <span className="grow-bar grid place-items-center bg-ink/70 text-[0.625rem] font-bold text-bg" style={{ width: `${((b ?? 0) / tot) * 100}%` }}>
                  {b != null && b / tot > 0.15 ? `L2 ${b.toFixed(1)}` : ""}
                </span>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ms.map(({ key, name, m, online, limit, at, src }) => {
              const ld = online ? m?.load : null;
              return (
                <div key={key} className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[0.75rem]">
                    <Lamp tone={online ? "ok" : "faint"} pulse={online} />
                    <span className="font-semibold text-ink">{name}</span>
                    <span className="truncate text-[0.6875rem] text-faint">{m?.specs?.cpu ?? ""}</span>
                    <span className="ml-auto flex items-baseline gap-1.5">
                      <Age at={at} now={now} src={src === "snapshot" ? "snapshot" : undefined} />
                      <span className="tnum font-semibold">{ld?.cpu == null ? (online ? "—" : "offline") : `${pctText(ld.cpu)}%`}</span>
                    </span>
                  </div>
                  <TickMeter value={ld?.cpu} max={100} limit={limit} ticks={40} height={10} label={`${name} CPU`} />
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted">
                    <span>RAM {ld?.ram == null ? "—" : `${Math.round(ld.ram)}%`}</span>
                    <span>GPU {ld?.gpu == null ? "—" : `${Math.round(ld.gpu)}%`}</span>
                    <span className={`text-${tempTone(ld?.temp_c)}`}>{ld?.temp_c == null ? "temp —" : `${ld.temp_c}°C`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function Machines({ s, loading }: { s: S; loading: boolean }) {
  const now = useNow(1000);
  const ms = machineList(s);
  return (
    <section aria-label="Machines" className="grid gap-4 xl:grid-cols-2">
      {ms.map(({ key, name, m, online, limit, at, src }) => (
        <Panel
          key={key}
          title={name}
          meta={
            loading ? null : (
              <>
                {m?.role ?? ""}
                {m?.specs?.host ? ` · ${m.specs.host}` : ""} · read <Age at={at} now={now} src={src === "snapshot" ? "snapshot" : src === "agent" ? "agent" : "tick"} />
              </>
            )
          }
          right={<Pill tone={online ? "ok" : "faint"}>{online ? "online" : "offline"}</Pill>}
        >
          {loading ? <Skel className="h-[16.25rem]" /> : !m ? <Empty>No readings from this machine yet.</Empty> : <MachineBody k={key} m={m} online={online} limit={limit} now={now} />}
        </Panel>
      ))}
    </section>
  );
}

function MachineBody({ k, m, online, limit, now }: { k: string; m: Machine; online: boolean; limit: number | null; now: number }) {
  const sp = m.specs ?? {};
  const ld = online ? (m.load ?? {}) : {};
  const renders = arr(m.renders);
  const procs = arr(m.procs);
  const { shown, toggle } = useShowMore(procs, 6);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.71875rem] sm:grid-cols-4">
        <div className="col-span-2">
          <dt className="label">CPU</dt>
          <dd className="truncate text-ink" title={sp.cpu ?? undefined}>
            {sp.cpu ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="label">Cores / threads</dt>
          <dd className="tnum">{sp.cores ?? "—"} / {sp.threads ?? "—"}</dd>
        </div>
        <div>
          <dt className="label">RAM</dt>
          <dd className="tnum">{sp.ram_gb != null ? `${sp.ram_gb} GB` : "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="label">GPU</dt>
          <dd className="truncate">{arr(sp.gpus).join(", ") || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="label">OS</dt>
          <dd className="truncate text-muted">{sp.os ?? "—"}</dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["CPU", ld.cpu, limit],
          ["RAM", ld.ram, null],
          ["GPU", ld.gpu, null],
        ].map(([label, v, lim]) => (
          <div key={label as string}>
            <div className="mb-1 flex items-baseline justify-between text-[0.75rem]">
              <span className="label">
                {label as string}
                {lim ? ` · cap ${lim}%` : ""}
              </span>
              <span className="tnum font-semibold">{v == null ? "—" : `${Math.round(v as number)}%`}</span>
            </div>
            <TickMeter value={v as number | null} max={100} limit={lim as number | null} ticks={40} height={10} label={`${label}`} />
          </div>
        ))}
        <div className="flex flex-col justify-end gap-1 text-[0.75rem]">
          <div className="flex justify-between">
            <span className="label">Temperature</span>
            <span className={`tnum font-semibold text-${tempTone(ld.temp_c)}`} title="ACPI thermal zone, hottest">
              {ld.temp_c == null ? "—" : `${ld.temp_c}°C`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="label">Network</span>
            <span className="tnum text-muted">
              ↑ {rate(ld.net_up_bps)} · ↓ {rate(ld.net_down_bps)}
            </span>
          </div>
        </div>
      </div>
      <div>
        <h3 className="label mb-1.5">Disks</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {arr(m.disks).map((d) => (
            <li key={d.drive} className="grid grid-cols-[1.875rem_minmax(0,1fr)_6rem] items-center gap-2 text-[0.71875rem]">
              <span className="font-semibold">{d.drive}</span>
              <span className="h-[0.375rem] bg-rule-strong/70">
                <span
                  className={`grow-bar block h-full ${(d.used_pct ?? 0) > 90 ? "bg-err" : (d.used_pct ?? 0) > 80 ? "bg-warn" : "bg-sodium"}`}
                  style={{ width: `${d.used_pct ?? 0}%` }}
                />
              </span>
              <span className="tnum text-right text-muted">{num(d.free_gb)} GB free</span>
            </li>
          ))}
        </ul>
      </div>
      {k === "laptop2" && (
        <div>
          <h3 className="label mb-1.5">Renders on laptop 2 (last 6 h)</h3>
          <SlotLine slots={m.slots} active={m.active ?? renders.filter((r) => ACTIVE_STAGES.includes(r.stage ?? "")).length} />
          {renders.length === 0 ? (
            <p className="text-[0.75rem] text-faint">No render jobs on disk.</p>
          ) : (
            <ul className="divide-y divide-rule/70" data-testid="l2-renders">
              {renders.map((r) => (
                <RenderRow key={`${r.path}-${r.clip}`} r={r} now={now} />
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <h3 className="label mb-1.5">{k === "main" ? "Heaviest processes: see Jobs below" : "Processes (python, ffmpeg, hermes, node)"}</h3>
        {k !== "main" &&
          (procs.length === 0 ? (
            <p className="text-[0.75rem] text-faint">{online ? "Nothing relevant running." : "Offline."}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {shown.map((p) => (
                  <li key={p.pid} className="grid grid-cols-[3.75rem_3.25rem_minmax(0,1fr)] gap-2 text-[0.71875rem]">
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="tnum text-right text-sodium">{p.cpu_pct == null ? "—" : `${p.cpu_pct.toFixed(1)}%`}</span>
                    <span className="truncate font-mono text-[0.65625rem] text-faint" title={p.cmd ?? undefined}>
                      {p.clip ? <span className="text-ink">{p.clip} </span> : null}
                      {p.cmd}
                    </span>
                  </li>
                ))}
              </ul>
              {toggle}
            </>
          ))}
      </div>
    </div>
  );
}

/** "1 render running · 1 slot held of 1 allowed (hot: 87 °C at 20:45)" from state/l2_slots. */
function SlotLine({ slots, active }: { slots: L2Slots | null | undefined; active: number }) {
  if (!slots) return null;
  const held = arr(slots.held);
  const over = slots.capacity != null && active > slots.capacity;
  return (
    <p className={`mb-1.5 text-[0.6875rem] ${over ? "text-err" : "text-muted"}`} data-testid="l2-slots">
      {active} running · {held.length} slot{held.length === 1 ? "" : "s"} held
      {slots.capacity != null ? ` of ${slots.capacity} allowed` : ""}
      {slots.hot ? <span className="text-warn"> · hot within 4 h ({slots.hot_reading ?? "above 85 °C"}): 1 slot max</span> : null}
      {held.length ? <span className="text-faint"> · {held.map((h) => `${h.owner}: ${h.clip}`).join(", ")}</span> : null}
      {over ? " · MORE RENDERS THAN THE SLOT RULE ALLOWS" : ""}
    </p>
  );
}

const STAGE_TONE: Record<string, Tone> = { render: "sodium", base: "sodium", upload: "ink", stale: "faint", done: "ok", failed: "err" };
const PATH_LABEL: Record<string, string> = { clip_run: "clip run", restyle_l2: "restyle", remote: "old test path" };

function RenderRow({ r, now }: { r: RenderJob; now: number }) {
  const active = ACTIVE_STAGES.includes(r.stage ?? "");
  const el = active && r.started ? (now - (toMs(r.started) ?? now)) / 1000 : (r.elapsed_s ?? null);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1.5 text-[0.75rem]" title={r.stage === "stale" ? "files left on disk with no process working on them: holds no slot" : undefined}>
      <div className="min-w-0">
        <span className={`font-semibold ${r.stage === "stale" ? "text-faint" : "text-ink"}`}>{r.clip}</span>
        <span className="ml-2 text-[0.6875rem] text-faint">{PATH_LABEL[r.path ?? ""] ?? r.path}</span>
        {r.error && <p className="truncate text-[0.6875rem] text-err">{r.error}</p>}
      </div>
      <Pill tone={STAGE_TONE[r.stage ?? ""] ?? "faint"}>
        {active && <Lamp tone="sodium" pulse />}
        {r.stage}
      </Pill>
      <span className="tnum w-16 text-right text-muted" title={active ? "elapsed" : "took"}>
        {el == null ? "—" : dur(el * 1000)}
      </span>
    </li>
  );
}

export function Docker({ docker, loading }: { docker: DockerStatus | null | undefined; loading: boolean }) {
  const cs = arr(docker?.containers);
  const running = cs.filter((c) => c.state === "running");
  const { shown, toggle } = useShowMore(cs, 6);
  return (
    <Panel title="Docker, main laptop" meta={loading ? null : `${running.length} running of ${cs.length} · running first`}>
      {loading ? (
        <Skel className="h-[10rem]" />
      ) : !docker ? (
        <Empty>No Docker reading in this snapshot.</Empty>
      ) : docker.ok === false ? (
        <Empty>Docker is not reachable: {docker.error}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-rule/70">
            {shown.map((c) => (
              <li key={c.name ?? ""} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5 text-[0.75rem]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Lamp tone={c.state === "running" ? (c.health === "unhealthy" ? "err" : "ok") : "faint"} pulse={c.state === "running"} />
                    <span className="truncate font-semibold text-ink">{c.name}</span>
                  </div>
                  <p className="truncate text-[0.6875rem] text-faint">{c.status}</p>
                </div>
                <div className="text-right text-[0.6875rem]">
                  {c.state === "running" ? (
                    <>
                      <div className="tnum text-sodium" title="docker stats: % of ONE core (can pass 100)">{c.cpu_pct == null ? "—" : `${c.cpu_pct.toFixed(1)}% of a core`}</div>
                      <div className="tnum text-muted">{c.mem_mib == null ? "—" : `${Math.round(c.mem_mib)} MiB`}</div>
                    </>
                  ) : (
                    <span className="text-faint">{c.state}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {toggle}
        </>
      )}
    </Panel>
  );
}
