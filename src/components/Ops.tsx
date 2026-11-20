"use client";

import { useMemo, useState } from "react";
import type { Commit, VercelStatus } from "@/lib/types";
import { ago, arr } from "@/lib/format";
import { Chips, Empty, ExtLink, Panel, Pill, Skel, useNow, useShowMore, type Tone } from "./ui";

export function GitActivity({ git, loading }: { git: Commit[] | null | undefined; loading: boolean }) {
  const now = useNow(30_000);
  const all = useMemo(() => arr(git), [git]);
  const repos = useMemo(() => ["all", ...[...new Set(all.map((c) => c.repo))].sort()], [all]);
  const [repo, setRepo] = useState("all");
  const list = repo === "all" ? all : all.filter((c) => c.repo === repo);
  const { shown, toggle } = useShowMore(list, 8);
  return (
    <Panel title="Code activity" meta={loading ? null : "latest commits, local git log every 5 min, newest first"} right={<Chips value={repo} options={repos} onChange={setRepo} label="Filter by repo" />}>
      {loading ? (
        <Skel className="h-[11.25rem]" />
      ) : list.length === 0 ? (
        <Empty>No commits reported.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-rule/70">
            {shown.map((c) => (
              <li key={`${c.repo}-${c.sha}`} className="py-1.5 text-[0.75rem]">
                <div className="flex items-baseline gap-2">
                  <span className="rounded-[2px] bg-rule px-1.5 text-[0.65625rem] font-semibold text-muted">{c.repo}</span>
                  <span className="min-w-0 flex-1 truncate text-ink" title={c.message ?? undefined}>
                    {c.message}
                  </span>
                </div>
                <div className="mt-0.5 flex gap-3 text-[0.65625rem] text-faint">
                  <span className="tnum">{c.sha}</span>
                  <span>{c.author}</span>
                  <span>{ago(c.at, now)}</span>
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

const TONE: Record<string, Tone> = { Ready: "ok", Error: "err", Building: "sodium", Queued: "faint", Canceled: "faint" };

export function VercelDeploys({ vercel, loading }: { vercel: VercelStatus | null | undefined; loading: boolean }) {
  const now = useNow(30_000);
  const d = arr(vercel?.deployments);
  return (
    <Panel title="Vercel deploys" meta={loading ? null : vercel?.at ? `vercel ls, read ${ago(vercel.at, now)} (every 10 min)` : null}>
      {loading ? (
        <Skel className="h-[7.5rem]" />
      ) : d.length === 0 ? (
        <Empty>{vercel?.error ?? "No deployment list yet."}</Empty>
      ) : (
        <ul className="divide-y divide-rule/70">
          {d.map((x) => (
            <li key={x.url ?? ""} className="flex items-center gap-2 py-1.5 text-[0.75rem]">
              <Pill tone={TONE[x.state ?? ""] ?? "faint"}>{x.state}</Pill>
              <ExtLink href={x.url} className="min-w-0 flex-1 truncate text-muted">
                {(x.url ?? "").replace("https://", "")}
              </ExtLink>
              <span className="text-[0.6875rem] text-faint">{x.env}</span>
              <span className="tnum w-10 text-right text-[0.6875rem] text-faint">{x.age}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
