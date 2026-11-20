"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SnapshotResponse } from "@/lib/types";
import type { Zone } from "@/lib/format";
import { InitialNowCtx, ZoneCtx } from "./ui";
import { Header, TABS, type TabKey } from "./Header";
import { Conveyor } from "./Conveyor";
import { Accounts } from "./Accounts";
import { Jobs } from "./Jobs";
import { Events } from "./Events";
import { Agents } from "./Agents";
import { ScheduleTimeline, ScheduleList, UpNext } from "./Schedule";
import { Queue, Holds } from "./Queue";
import { Streams } from "./Streams";
import { Research, Discovery } from "./Research";
import { ActivityChart, AnalyticsPanel, ClaudeUsage, Vitals } from "./Analytics";

const POLL_MS = 30_000;

export function Console({ initial, serverNow }: { initial: SnapshotResponse | null; serverNow: number }) {
  const [data, setData] = useState<SnapshotResponse | null>(initial);
  const [loaded, setLoaded] = useState(initial != null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [zone, setZoneState] = useState<Zone>("IST");
  const [tab, setTab] = useState<TabKey>("overview");
  const router = useRouter();

  // restore per-viewer preferences after hydration
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabKey;
      if (TABS.some((t) => t.key === h)) setTab(h);
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
        setData(body);
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
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [initial, router]);

  const s = data?.snapshot ?? null;
  const history = data?.history ?? [];
  const loading = !loaded;

  return (
    <InitialNowCtx.Provider value={serverNow}>
      <ZoneCtx.Provider value={{ zone, setZone }}>
        <div className="relative z-10 min-h-dvh">
          <Header snapshot={s} loading={loading} fetchError={fetchError} tab={tab} onTab={selectTab} />
          <main id="main" className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 pb-16 pt-4 sm:px-6">
            {!loading && !s && (
              <div role="status" className="panel border-warn/40 px-4 py-3 text-[12px] text-warn">
                No snapshot has arrived yet. The exporter on the main laptop posts to /api/ingest every 2 minutes;
                this page fills in on the next poll.
              </div>
            )}
            {tab === "overview" && (
              <>
                <Conveyor p={s?.pipeline} accounts={s?.accounts} loading={loading} />
                <Accounts accounts={s?.accounts} loading={loading} />
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <UpNext schedule={s?.schedule} loading={loading} onMore={() => selectTab("schedule")} />
                  <Vitals system={s?.system} loading={loading} />
                  <ClaudeUsage claude={s?.claude} loading={loading} />
                </div>
                <Jobs jobs={s?.jobs} loading={loading} />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
                  <Events events={s?.events} loading={loading} />
                  <Agents agents={s?.agents} loading={loading} />
                </div>
                <ActivityChart history={history} snapshot={s} loading={loading} />
              </>
            )}
            {tab === "schedule" && (
              <>
                <ScheduleTimeline schedule={s?.schedule} accounts={s?.accounts} loading={loading} />
                <ScheduleList schedule={s?.schedule} loading={loading} />
              </>
            )}
            {tab === "queue" && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Queue queue={s?.queue} loading={loading} />
                <Holds holds={s?.holds} held={s?.pipeline?.held} loading={loading} />
              </div>
            )}
            {tab === "streams" && <Streams streams={s?.streams} pipeline={s?.pipeline} loading={loading} />}
            {tab === "research" && (
              <>
                <Discovery discovery={s?.discovery} loading={loading} />
                <Research research={s?.research} loading={loading} />
              </>
            )}
            {tab === "analytics" && (
              <>
                <AnalyticsPanel analytics={s?.analytics} loading={loading} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                  <ActivityChart history={history} snapshot={s} loading={loading} />
                  <ClaudeUsage claude={s?.claude} loading={loading} />
                </div>
              </>
            )}
            <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-[11px] text-faint">
              <span>host {s?.host ?? "—"}</span>
              <span>snapshot schema {s?.schema ?? "—"}</span>
              <span>polls every 30 s</span>
              <form method="post" action="/api/logout" className="ml-auto">
                <button type="submit" className="underline-offset-2 hover:text-sodium hover:underline">
                  Sign out
                </button>
              </form>
            </footer>
          </main>
        </div>
      </ZoneCtx.Provider>
    </InitialNowCtx.Provider>
  );
}
