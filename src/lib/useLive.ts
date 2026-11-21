"use client";

import { useEffect, useRef, useState } from "react";
import type { DockerStatus, L2AgentLine, LiveTokenResponse, Snapshot, Tick } from "./types";

export type LiveStatus = "connecting" | "live" | "down" | "nourl";

export interface Hello {
  doing?: Tick["doing"];
  jobs?: Tick["jobs"];
  l2_agent?: L2AgentLine | null;
  l2?: Tick["l2"];
  slots?: Tick["slots"];
  docker?: DockerStatus | null;
  server_time?: string;
}

interface Handlers {
  onSnapshot: (s: Snapshot) => void;
  onTick: (t: Tick) => void;
  onHello: (h: Hello) => void;
  onUnauthorized: () => void;
}

const STALE_MS = 6_000; // no tick for this long = the channel is down
const HIDDEN_CLOSE_MS = 60_000; // a hidden tab lets go of the laptop after a minute
const RETRY_MAX_MS = 20_000; // while the laptop is away: ask /api/live-token for the (new) tunnel URL this often

/**
 * The laptop's live channel: token + tunnel URL from /api/live-token, then a WebSocket to
 * <tunnel>/ws?t=<token> (same messages as the /live SSE stream). Re-fetches the token a minute before it expires, reconnects with backoff
 * (2 s doubling to 20 s; every attempt re-reads the tunnel URL, so a laptop back from a reboot with a NEW quick-tunnel URL is found
 * without a page reload),
 * closes while the tab is hidden (so nobody watching = no work on the laptop).
 */
export function useLive(handlers: Handlers): { status: LiveStatus; lastTickAt: number | null } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });

  useEffect(() => {
    let alive = true;
    let es: WebSocket | null = null;
    let retry = 0;
    let lastMsg = 0;
    let retryTimer: number | undefined;
    let refreshTimer: number | undefined;
    let hiddenTimer: number | undefined;

    const clearTimers = () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(refreshTimer);
    };
    const close = () => {
      es?.close();
      es = null;
      lastMsg = 0;
    };
    const scheduleRetry = (ms: number) => {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(connect, ms);
    };
    const fail = () => {
      close();
      if (!alive) return;
      setStatus((s) => (s === "nourl" ? s : "down"));
      retry += 1;
      scheduleRetry(Math.min(RETRY_MAX_MS, 2_000 * 2 ** Math.min(retry, 5)));
    };

    async function connect() {
      if (!alive || document.visibilityState === "hidden") return;
      clearTimers();
      let info: LiveTokenResponse;
      try {
        const r = await fetch("/api/live-token", { cache: "no-store" });
        if (r.status === 401) {
          h.current.onUnauthorized();
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        info = (await r.json()) as LiveTokenResponse;
      } catch {
        fail();
        return;
      }
      if (!alive) return;
      if (!info.url) {
        close();
        setStatus("nourl");
        scheduleRetry(RETRY_MAX_MS);
        return;
      }
      // WebSocket: Cloudflare quick tunnels pass WS frames through at once (they hold SSE back)
      const next = new WebSocket(`${info.url.replace(/^http/, "ws")}/ws?t=${encodeURIComponent(info.token)}`);
      const prev = es;
      es = next;
      prev?.close();
      next.onmessage = (ev) => {
        if (es !== next) return;
        let m: { e?: string; d?: unknown } | null = null;
        try {
          m = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (!m) return;
        lastMsg = Date.now();
        if (m.e === "snapshot") h.current.onSnapshot(m.d as Snapshot);
        else if (m.e === "hello") h.current.onHello(m.d as Hello);
        else if (m.e === "tick") {
          retry = 0;
          setStatus("live");
          setLastTickAt(lastMsg);
          h.current.onTick(m.d as Tick);
        } else if (m.e === "expired") connect();
      };
      next.onclose = () => {
        if (es === next) fail();
      };
      // new token a minute before this one runs out
      refreshTimer = window.setTimeout(connect, Math.max(30_000, info.exp * 1000 - Date.now() - 60_000));
    }

    const watchdog = window.setInterval(() => {
      if (es && lastMsg && Date.now() - lastMsg > STALE_MS) fail();
    }, 2_000);

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer = window.setTimeout(() => {
          clearTimers();
          close();
          setStatus("down");
        }, HIDDEN_CLOSE_MS);
      } else {
        window.clearTimeout(hiddenTimer);
        if (!es) {
          retry = 0;
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    connect();
    return () => {
      alive = false;
      clearTimers();
      window.clearTimeout(hiddenTimer);
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVis);
      close();
    };
  }, []);

  return { status, lastTickAt };
}
