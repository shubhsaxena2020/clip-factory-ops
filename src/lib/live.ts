import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Live-channel token for the laptop's SSE server: "<exp>.<hex HMAC-SHA256(INGEST_TOKEN, exp)>".
// The laptop verifies it with the same INGEST_TOKEN (pipeline/clipper/dashboard_live.py).
export const LIVE_TOKEN_TTL_S = 10 * 60;

export function liveToken(nowMs = Date.now()): { token: string; exp: number } | null {
  const secret = process.env.INGEST_TOKEN;
  if (!secret) return null;
  const exp = Math.floor(nowMs / 1000) + LIVE_TOKEN_TTL_S;
  const sig = createHmac("sha256", secret).update(String(exp)).digest("hex");
  return { token: `${exp}.${sig}`, exp };
}

/** Bearer check shared by the laptop-facing routes (constant time, length hidden by hashing). */
export function bearerOk(header: string | null): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const TUNNEL_URL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
