import { Console } from "@/components/Console";
import { readHistory, readSnapshot, serverTime } from "@/lib/store";
import type { SnapshotResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initial: SnapshotResponse | null = null;
  try {
    const [{ snapshot, storedAt }, history] = await Promise.all([readSnapshot(), readHistory().catch(() => [])]);
    initial = { snapshot, history, stored_at: storedAt };
  } catch {
    initial = null; // the client poll will retry and show the error state
  }
  return <Console initial={initial} serverNow={serverTime()} />;
}
