import { bearerOk, TUNNEL_URL } from "@/lib/live";
import { writeLive } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// The laptop's live job posts its cloudflared quick-tunnel URL here when it changes (a few times a
// day at most). Same bearer token as /api/ingest. Only *.trycloudflare.com URLs are accepted.
export async function POST(req: Request) {
  if (!bearerOk(req.headers.get("authorization"))) return json(401, { error: "unauthorized" });
  const body = (await req.json().catch(() => null)) as { url?: unknown; at?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim().replace(/\/+$/, "") : "";
  if (!TUNNEL_URL.test(url)) return json(422, { error: "url must be https://<name>.trycloudflare.com" });
  const at = typeof body?.at === "string" && !Number.isNaN(Date.parse(body.at)) ? body.at : new Date().toISOString();
  try {
    const written = await writeLive(url, at);
    return json(200, { ok: true, written });
  } catch (e) {
    console.error("live.json write failed", e instanceof Error ? e.message : e);
    return json(502, { error: "storage write failed" });
  }
}
