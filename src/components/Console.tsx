"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot, SnapshotResponse, Tick } from "@/lib/types";
import type { Zone } from "@/lib/format";
import { dur, stamp, toMs } from "@/lib/format";
import { applyTick, EMPTY_LIVE, overlay, type LiveState } from "@/lib/derive";
import { useLive, type Hello } from "@/lib/useLive";
import { InitialNowCtx, LiveCtx, ZoneCtx, useNowIn } from "./ui";
import { Header, TABS, type TabKey } from "./Header";
import { OverviewPage, PublishingPage, ProductionPage, IntelPage, AnalyticsPage } from "./Pages";

const POLL_FALLBACK_MS = 15_000; // live channel down: poll the stored snapshot
const POLL_LIVE_MS = 5 * 60_000; // live: only the hourly history needs Vercel
const CPU_POINTS = 120; // the header sparkline: 60 s of 0.5-s ticks
const OFFLINE_MS = 7 * 60_000; // no tick and a snapshot older than this: the laptop is off / asleep

export function Console({ initial, serverNow }: { initial: SnapshotResponse | null; serverNow: number }) {
  const [snap, setSnap] = useState<Snapshot | null>(initial?.snapshot ?? null);
  const [history, setHistory] = useState(initial?.history ?? []);
  const [loaded, setLoaded] = useState(initial != null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [zone, setZoneState] = useState<Zone>("IST");
  const [tab, setTab] = useState<TabKey>("overview");
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE);
  const [cpuSeries, setCpuSeries] = useState<number[]>([]);
  const router = useRouter();

  const onSnapshot = useCallback((s: Snapshot) => {
    setSnap(s);
    setLoaded(true);
  }, []);
  const onTick = useCallback((t: Tick) => {
    setLive((p) => applyTick(p, t));
    if (t.cpu != null) setCpuSeries((s) => [...s.slice(-(CPU_POINTS - 1)), t.cpu as number]);
  }, []);
  const onHello = useCallback((h: Hello) => {
    setLive((p) => ({
      ...p,
      doing: { ...p.doing, ...(h.doing ?? {}) },
      jobs: h.jobs && Object.keys(h.jobs).length ? h.jobs : p.jobs,
      l2agent: h.l2_agent ?? p.l2agent,
      l2: h.l2 ?? p.l2,
      slots: h.slots ?? p.slots,
      docker: h.docker ?? p.docker,
    }));
  }, []);
  const onUnauthorized = useCallback(() => router.replace("/login"), [router]);
  const { status, lastTickAt } = useLive({ onSnapshot, onTick, onHello, onUnauthorized });
  const isLive = status === "live";

  // restore per-viewer preferences after hydration
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      const legacy: Record<string, TabKey> = { schedule: "publishing", queue: "publishing", streams: "production", research: "intel" };
      const k = (legacy[h] ?? h) as TabKey;
      if (TABS.some((t) => t.key === k)) setTab(k);
    };
    const restore = requestAnimationFrame(() => {
      try {
        const z = localStorage.getItem("cfo.zone");
        if (z === "ET" || z === "IST") setZoneState(z);
      } catch {
        /* storage blocked */
      }
      fromHash();
    });
    window.addEventListener("hashchange", fromHash);
    return () => {
      cancelAnimationFrame(restore);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);

  const setZone = useCallback((z: Zone) => {
    setZoneState(z);
    try {
      localStorage.setItem("cfo.zone", z);
    } catch {
      /* ignore */
    }
  }, []);

  const selectTab = useCallback((t: TabKey) => {
    setTab(t);
    window.history.replaceState(null, "", t === "overview" ? window.location.pathname : `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  // stored snapshot from Vercel: every 15 s while the live channel is down, every 5 min (history) while live
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/snapshot", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as SnapshotResponse;
        if (!alive) return;
        setHistory(body.history ?? []);
        // never replace newer (live) data with an older stored snapshot
        setSnap((cur) => ((toMs(body.snapshot?.generated_at) ?? 0) >= (toMs(cur?.generated_at) ?? 0) ? body.snapshot : cur));
        setFetchError(null);
      } catch (e) {
        if (alive) setFetchError(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (alive) setLoaded(true);
      }
    };
    if (!initial) load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, isLive ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial, router, isLive]);

  // re-evaluated every 2 s even without ticks, so a reading that stops arriving ages visibly
  const clock = useNowIn(serverNow, 2000);
  const s = useMemo(() => overlay(snap, live, Math.max(clock, live.at ?? 0)), [snap, live, clock]);
  const loading = !loaded;
  const liveView = useMemo(() => ({ status, lastTickAt, cpuSeries }), [status, lastTickAt, cpuSeries]);

  return (
    <InitialNowCtx.Provider value={serverNow}>
      <ZoneCtx.Provider value={{ zone, setZone }}>
        <LiveCtx.Provider value={liveView}>
          <div className="relative z-10 min-h-dvh">
            <Header snapshot={s} loading={loading} fetchError={fetchError} tab={tab} onTab={selectTab} />
            <main id="main" className="mx-auto flex max-w-[80rem] flex-col gap-5 px-4 pb-16 pt-4 sm:px-6">
              {!loading && s && !isLive && <OfflineBanner generatedAt={s.generated_at} status={status} now={clock} />}
              {!loading && !s && (
                <div role="status" className="panel border-warn/40 px-4 py-3 text-[0.75rem] text-warn">
                  No snapshot has arrived yet. The exporter on the main laptop posts one every 5 minutes, and the live
                  channel sends one as soon as the laptop is reachable.
                </div>
              )}
              <div key={tab} className="page-in flex flex-col gap-6">
                {tab === "overview" && <OverviewPage s={s} loading={loading} onTab={selectTab} />}
                {tab === "publishing" && <PublishingPage s={s} loading={loading} />}
                {tab === "production" && <ProductionPage s={s} loading={loading} />}
                {tab === "intel" && <IntelPage s={s} loading={loading} />}
                {tab === "analytics" && <AnalyticsPage s={s} history={history} loading={loading} />}
              </div>
              <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-[0.6875rem] text-faint">
                <span>host {s?.host ?? "—"}</span>
                <span>snapshot schema {s?.schema ?? "—"}</span>
                <span>
                  {isLive
                    ? "live: a tick every 0.5 s from the laptop (CPU, RAM, laptop 2, jobs, events), the full snapshot when it changes (at most every 15 s)"
                    : "live channel down: stored snapshot polled every 15 s (the exporter writes one every 5 min); reconnecting by itself; every live number shows its age"}
                </span>
                <form method="post" action="/api/logout" className="ml-auto">
                  <button type="submit" className="underline-offset-2 hover:text-sodium hover:underline">
                    Sign out
                  </button>
                </form>
              </footer>
            </main>
          </div>
        </LiveCtx.Provider>
      </ZoneCtx.Provider>
    </InitialNowCtx.Provider>
  );
}

/** The laptop is off, asleep or offline: say since when, and that the page comes back by itself. */
function OfflineBanner({ generatedAt, status, now }: { generatedAt: string | null | undefined; status: string; now: number }) {
  const gen = toMs(generatedAt);
  if (gen == null) return null;
  const age = now - gen;
  if (age < OFFLINE_MS) {
    if (status === "connecting") return null;
    return (
      <div role="status" data-testid="link-banner" className="panel border-warn/35 px-4 py-2 text-[0.75rem] text-warn">
        The live link is reconnecting (the laptop is up: its snapshot is {dur(age)} old). Live numbers show their age meanwhile.
      </div>
    );
  }
  return (
    <div role="status" data-testid="offline-banner" className="panel flex flex-wrap items-baseline gap-x-2 gap-y-1 border-err/45 bg-err/[0.06] px-4 py-3 text-[0.78125rem]">
      <span className="font-semibold text-err">Laptop offline since {stamp(generatedAt, "IST")} IST ({dur(age)} ago).</span>
      <span className="text-muted">
        Showing its last snapshot. Nothing on this page is live until the laptop is back; then it reconnects by itself (it retries every 20 s), no reload needed.
      </span>
    </div>
  );
}
