"use client";

import { useMemo } from "react";
import type { HistoryDay, ScheduleItem, Snapshot } from "@/lib/types";
import { arr } from "@/lib/format";
import { igPlanned } from "@/lib/derive";
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
import { AccountHealth, Attention, HoldReasons, RenderSplit } from "./Health";
import { FollowersPanel, RunningCost } from "./Audience";
import { Section, Split, useNow } from "./ui";

type P = { s: Snapshot | null; loading: boolean };

/** The schedule plus Instagram's upcoming fixed slots (posted live, never pre-booked) as "planned" rows. */
function useScheduleWithPlanned(s: Snapshot | null): ScheduleItem[] {
  const minute = Math.floor(useNow(30_000) / 60_000);
  const schedule = s?.schedule;
  const accounts = s?.accounts;
  return useMemo(() => [...arr(schedule), ...igPlanned(accounts, schedule, minute * 60_000)], [schedule, accounts, minute]);
}

export function OverviewPage({ s, loading, onTab }: P & { onTab: (t: TabKey) => void }) {
  const sched = useScheduleWithPlanned(s);
  return (
    <>
      <Section title="Right now" hint="headline numbers; CPU and laptop 2 update every 0.5 s">
        <Kpis s={s} loading={loading} />
        <div className="grid gap-4 lg:grid-cols-2">
          <UpNext schedule={sched} loading={loading} onMore={() => onTab("publishing")} />
          <Attention s={s} loading={loading} onTab={onTab} />
        </div>
      </Section>
      <Section title="The funnel" hint="from a live stream to a published Short">
        <Conveyor p={s?.pipeline} loading={loading} />
        <StatusBoard s={s} loading={loading} />
      </Section>
      <Section title="Accounts" right={<button type="button" onClick={() => onTab("publishing")} className="text-[0.6875rem] text-muted underline-offset-2 hover:text-sodium hover:underline">Account health</button>}>
        <AccountTiles accounts={s?.accounts} followers={s?.followers?.accounts} loading={loading} onMore={() => onTab("publishing")} />
      </Section>
      <Section title="Activity" hint="what every job and agent is doing">
        <Split side="minmax(0,0.8fr)">
          <Activity jobs={s?.jobs} events={s?.events} loading={loading} />
          <div className="flex min-w-0 flex-col gap-4">
            <AgentsNow agents={s?.agents} loading={loading} onMore={() => onTab("intel")} />
            <LoadSplit s={s} loading={loading} onMore={() => onTab("production")} />
          </div>
        </Split>
      </Section>
    </>
  );
}

export function PublishingPage({ s, loading }: P) {
  const sched = useScheduleWithPlanned(s);
  return (
    <>
      <Section title="Schedule" hint="what goes out when, both platforms">
        <ScheduleTimeline schedule={sched} accounts={s?.accounts} loading={loading} />
        <ScheduleByDay schedule={sched} accounts={s?.accounts} loading={loading} />
      </Section>
      <Section title="Accounts">
        <AccountHealth accounts={s?.accounts} followers={s?.followers?.accounts} loading={loading} />
        <AccountDetail accounts={s?.accounts} loading={loading} />
      </Section>
      <Section title="Queue and holds" hint="what the uploaders pick next, and what is kept back">
        <Queue queue={s?.queue} loading={loading} />
        <Split side="minmax(0,1fr)">
          <HoldReasons hb={s?.holds_breakdown} held={s?.pipeline?.held} loading={loading} />
          <Holds holds={s?.holds} held={s?.pipeline?.held} loading={loading} />
        </Split>
      </Section>
    </>
  );
}

export function ProductionPage({ s, loading }: P) {
  return (
    <>
      <Section title="Machines" hint="both laptops, live">
        <Machines s={s} loading={loading} />
        <RenderSplit s={s} loading={loading} />
      </Section>
      <Section title="Jobs">
        <Jobs jobs={s?.jobs} loading={loading} />
      </Section>
      <Section title="Streams and counts">
        <Split side="minmax(0,1fr)">
          <Streams streams={s?.streams} pipeline={s?.pipeline} loading={loading} />
          <div className="flex min-w-0 flex-col gap-4">
            <PipelineCounts p={s?.pipeline} loading={loading} />
            <Docker docker={s?.docker} loading={loading} />
          </div>
        </Split>
      </Section>
    </>
  );
}

export function IntelPage({ s, loading }: P) {
  return (
    <>
      <Section title="Agents">
        <Agents agents={s?.agents} loading={loading} />
      </Section>
      <Section title="Research and code">
        <div className="grid gap-4 xl:grid-cols-2">
          <Research research={s?.research} loading={loading} />
          <div className="flex min-w-0 flex-col gap-4">
            <Discovery discovery={s?.discovery} loading={loading} />
            <GitActivity git={s?.git} loading={loading} />
          </div>
        </div>
      </Section>
    </>
  );
}

export function AnalyticsPage({ s, history, loading }: P & { history: HistoryDay[] }) {
  return (
    <>
      <Section title="Audience" hint="subscribers and followers per account">
        <FollowersPanel followers={s?.followers} loading={loading} />
      </Section>
      <Section title="Performance" hint="Studio's own numbers first, then public counts">
        <StudioStatsPanel stats={s?.studio_stats} loading={loading} />
        <ShortsStats stats={s?.platform_stats} loading={loading} />
        <AnalyticsPanel analytics={s?.analytics} loading={loading} />
      </Section>
      <Section title="Output and cost">
        <ActivityChart history={history} snapshot={s} loading={loading} />
        <div className="grid gap-4 lg:grid-cols-2">
          <RunningCost s={s} loading={loading} />
          <div className="flex min-w-0 flex-col gap-4">
            <ClaudeUsage claude={s?.claude} loading={loading} />
            <VercelDeploys vercel={s?.vercel} loading={loading} />
          </div>
        </div>
      </Section>
    </>
  );
}
