// HMAC-signed session cookie. Web Crypto only, so it runs in the proxy and in route handlers.
// Token format: v1.<expiryEpochSeconds>.<base64url(HMAC-SHA256(key, "v1.<expiry>"))>
// The key is derived from DASHBOARD_PASSWORD + INGEST_TOKEN (or SESSION_SECRET when set), so
// rotating the password invalidates every existing session.

export const SESSION_COOKIE = "cfo_session";
export const SESSION_TTL_S = 30 * 24 * 60 * 60;

const enc = new TextEncoder();

function secretMaterial(): string | null {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return explicit;
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return null;
  return `cfo-session:${pw}:${process.env.INGEST_TOKEN ?? ""}`;
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string | null> {
  const material = secretMaterial();
  if (!material) return null;
  const key = await crypto.subtle.importKey("raw", enc.encode(material), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time string comparison (length leak only). */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(nowMs = Date.now()): Promise<string | null> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_S;
  const payload = `v1.${exp}`;
  const sig = await hmac(payload);
  return sig ? `${payload}.${sig}` : null;
}

export async function verifySessionToken(token: string | undefined | null, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  if (!expected) return false;
  return safeEqual(parts[2], expected);
}

/** Compare a submitted password with DASHBOARD_PASSWORD via HMAC digests (constant time). */
export async function passwordMatches(candidate: string): Promise<boolean> {
  const real = process.env.DASHBOARD_PASSWORD;
  if (!real) return false;
  const [a, b] = await Promise.all([hmac(`pw:${candidate}`), hmac(`pw:${real}`)]);
  return !!a && !!b && safeEqual(a, b);
}
