"use client";

import type { HistoryDay, Snapshot } from "@/lib/types";
import type { TabKey } from "./Header";
import { Conveyor } from "./Conveyor";
import { AccountDetail, AccountTiles } from "./Accounts";
import { Jobs } from "./Jobs";
import { Agents, AgentsNow } from "./Agents";
import { ScheduleByDay, ScheduleTimeline, UpNext } from "./Schedule";
import { Holds, Queue } from "./Queue";
import { Streams } from "./Streams";
import { Discovery, Research } from "./Research";
import { ActivityChart, AnalyticsPanel, ClaudeUsage, ShortsStats, StudioStatsPanel } from "./Analytics";
import { Activity, Kpis, PipelineCounts, StatusBoard } from "./Overview";
import { Docker, LoadSplit, Machines } from "./Machines";
import { GitActivity, VercelDeploys } from "./Ops";

type P = { s: Snapshot | null; loading: boolean };

export function OverviewPage({ s, loading, onTab }: P & { onTab: (t: TabKey) => void }) {
  return (
    <>
      <Kpis s={s} loading={loading} />
      <Conveyor p={s?.pipeline} loading={loading} />
      <StatusBoard s={s} loading={loading} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Activity jobs={s?.jobs} events={s?.events} loading={loading} />
        <div className="flex min-w-0 flex-col gap-4">
          <UpNext schedule={s?.schedule} loading={loading} onMore={() => onTab("publishing")} />
          <AgentsNow agents={s?.agents} loading={loading} onMore={() => onTab("intel")} />
        </div>
      </div>
      <AccountTiles accounts={s?.accounts} loading={loading} onMore={() => onTab("publishing")} />
      <LoadSplit s={s} loading={loading} onMore={() => onTab("production")} />
    </>
  );
}

export function PublishingPage({ s, loading }: P) {
  return (
    <>
      <ScheduleTimeline schedule={s?.schedule} accounts={s?.accounts} loading={loading} />
      <ScheduleByDay schedule={s?.schedule} accounts={s?.accounts} loading={loading} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23.75rem]">
        <Queue queue={s?.queue} loading={loading} />
        <Holds holds={s?.holds} held={s?.pipeline?.held} loading={loading} />
      </div>
      <AccountDetail accounts={s?.accounts} loading={loading} />
    </>
  );
}

export function ProductionPage({ s, loading }: P) {
  return (
    <>
      <Machines s={s} loading={loading} />
      <Jobs jobs={s?.jobs} loading={loading} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Streams streams={s?.streams} pipeline={s?.pipeline} loading={loading} />
        <div className="flex min-w-0 flex-col gap-4">
          <PipelineCounts p={s?.pipeline} loading={loading} />
          <Docker docker={s?.docker} loading={loading} />
        </div>
      </div>
    </>
  );
}

export function IntelPage({ s, loading }: P) {
  return (
    <>
      <Agents agents={s?.agents} loading={loading} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Research research={s?.research} loading={loading} />
        <div className="flex min-w-0 flex-col gap-4">
          <Discovery discovery={s?.discovery} loading={loading} />
          <GitActivity git={s?.git} loading={loading} />
        </div>
      </div>
    </>
  );
}

export function AnalyticsPage({ s, history, loading }: P & { history: HistoryDay[] }) {
  return (
    <>
      <StudioStatsPanel stats={s?.studio_stats} loading={loading} />
      <ShortsStats stats={s?.platform_stats} loading={loading} />
      <AnalyticsPanel analytics={s?.analytics} loading={loading} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
        <ActivityChart history={history} snapshot={s} loading={loading} />
        <div className="flex min-w-0 flex-col gap-4">
          <ClaudeUsage claude={s?.claude} loading={loading} />
          <VercelDeploys vercel={s?.vercel} loading={loading} />
        </div>
      </div>
    </>
  );
}
