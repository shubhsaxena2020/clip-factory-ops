import { createHash, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { maybeWriteHistory, writeSnapshot } from "@/lib/store";
import type { Snapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

function tokenOk(header: string | null): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected || !header?.startsWith("Bearer ")) return false;
  // Hash both sides so timingSafeEqual gets equal-length buffers and length is not leaked.
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get("authorization"))) return json(401, { error: "unauthorized" });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return json(413, { error: "body larger than 5 MB" });

  let raw: Buffer;
  try {
    raw = Buffer.from(await req.arrayBuffer());
  } catch {
    return json(400, { error: "could not read body" });
  }
  if (raw.length > MAX_BYTES) return json(413, { error: "body larger than 5 MB" });

  // Accept gzip either declared via Content-Encoding or detected by magic bytes (some runtimes
  // transparently strip the header).
  const gz = /gzip/i.test(req.headers.get("content-encoding") ?? "") || (raw[0] === 0x1f && raw[1] === 0x8b);
  let text: string;
  try {
    const body = gz && raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw, { maxOutputLength: MAX_BYTES }) : raw;
    text = body.toString("utf8");
  } catch {
    return json(400, { error: "invalid gzip body or decompressed size over 5 MB" });
  }
  if (Buffer.byteLength(text) > MAX_BYTES) return json(413, { error: "decompressed body larger than 5 MB" });

  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    return json(400, { error: "body is not valid JSON" });
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || snapshot.schema !== 1) {
    return json(422, { error: "expected an object with schema === 1" });
  }

  try {
    const storedAt = await writeSnapshot(snapshot);
    let history = false;
    try {
      history = await maybeWriteHistory(snapshot);
    } catch (e) {
      console.error("history write failed", e instanceof Error ? e.message : e);
    }
    return json(200, { ok: true, stored_at: storedAt, bytes: Buffer.byteLength(text), history_written: history });
  } catch (e) {
    console.error("snapshot write failed", e instanceof Error ? e.message : e);
    return json(502, { error: "storage write failed" });
  }
}
