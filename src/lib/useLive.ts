"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveTokenResponse, Snapshot, Tick } from "./types";

export type LiveStatus = "connecting" | "live" | "down" | "nourl";

export interface Hello {
  doing?: Tick["doing"];
  jobs?: Tick["jobs"];
  l2_agent?: unknown;
  docker?: unknown;
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

/**
 * The laptop's live channel: token + tunnel URL from /api/live-token, then an EventSource to
 * <tunnel>/live?t=<token>. Re-fetches the token a minute before it expires, reconnects with backoff,
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
    let es: EventSource | null = null;
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
      scheduleRetry(Math.min(60_000, 2_000 * 2 ** Math.min(retry, 5)));
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
        scheduleRetry(30_000);
        return;
      }
      const next = new EventSource(`${info.url}/live?t=${encodeURIComponent(info.token)}`);
      const prev = es;
      es = next;
      prev?.close();
      const parse = (e: MessageEvent) => {
        try {
          return JSON.parse(e.data as string);
        } catch {
          return null;
        }
      };
      next.addEventListener("snapshot", (e) => {
        const d = parse(e as MessageEvent);
        if (d) h.current.onSnapshot(d as Snapshot);
      });
      next.addEventListener("hello", (e) => {
        const d = parse(e as MessageEvent);
        if (d) h.current.onHello(d as Hello);
      });
      next.addEventListener("tick", (e) => {
        const d = parse(e as MessageEvent);
        if (!d || es !== next) return;
        lastMsg = Date.now();
        retry = 0;
        setStatus("live");
        setLastTickAt(lastMsg);
        h.current.onTick(d as Tick);
      });
      next.addEventListener("expired", () => {
        if (es === next) connect();
      });
      next.onerror = () => {
        if (es === next) fail();
        else next.close();
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
