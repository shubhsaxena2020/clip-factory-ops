import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { readHistory, readSnapshot } from "@/lib/store";
import type { SnapshotResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [{ snapshot, storedAt }, history] = await Promise.all([readSnapshot(), readHistory().catch(() => [])]);
    const body: SnapshotResponse = { snapshot, history, stored_at: storedAt };
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("snapshot read failed", e instanceof Error ? e.message : e);
    return Response.json({ error: "storage read failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
