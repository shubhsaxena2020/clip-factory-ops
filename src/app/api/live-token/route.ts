import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { liveToken } from "@/lib/live";
import { readLive } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session-protected: a 10-minute token for the laptop's live SSE server plus its current tunnel URL.
export async function GET() {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const t = liveToken();
  if (!t) return Response.json({ error: "INGEST_TOKEN not set" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  const live = await readLive().catch(() => ({ url: null, at: null }));
  return Response.json({ ...t, url: live.url, url_at: live.at }, { headers: { "Cache-Control": "private, no-store" } });
}
