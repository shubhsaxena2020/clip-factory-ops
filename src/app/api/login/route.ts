import { NextResponse } from "next/server";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_TTL_S } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Small in-memory throttle per instance: 10 failed attempts per IP per 10 minutes.
const fails = new Map<string, { n: number; first: number }>();

function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "/";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/api/") ? v : "/";
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first < 10 * 60_000 && rec.n >= 10) {
    return NextResponse.redirect(new URL("/login?e=throttled", req.url), 303);
  }

  const form = await req.formData().catch(() => null);
  const password = form?.get("password");
  const next = safeNext(form?.get("next") ?? null);

  if (typeof password !== "string" || !(await passwordMatches(password))) {
    const r = rec && now - rec.first < 10 * 60_000 ? rec : { n: 0, first: now };
    r.n += 1;
    fails.set(ip, r);
    return NextResponse.redirect(new URL(`/login?e=wrong&next=${encodeURIComponent(next)}`, req.url), 303);
  }

  fails.delete(ip);
  const token = await createSessionToken();
  if (!token) return NextResponse.redirect(new URL("/login?e=config", req.url), 303);
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}
