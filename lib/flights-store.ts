import { isBlobStoreConfigured, readJson, writeJson } from "@/lib/blob-store";
import type { FlightHistory, FlightSnapshot } from "@/types";

/**
 * Persistence for the flight crawler (see lib/blob-store.ts).
 *
 * flights/latest.json              newest snapshot (read by /api/flights)
 * flights/history.json             cheapest fare per destination per day
 * flights/snapshots/YYYY-MM-DD.json  daily archive of full snapshots
 */

const LATEST_PATH = "flights/latest.json";
const HISTORY_PATH = "flights/history.json";
const snapshotPath = (day: string) => `flights/snapshots/${day}.json`;

export const isFlightStoreConfigured = isBlobStoreConfigured;

export function readLatestSnapshot() {
  return readJson<FlightSnapshot>(LATEST_PATH);
}

export function readHistory() {
  return readJson<FlightHistory>(HISTORY_PATH);
}

export async function saveCrawl(snapshot: FlightSnapshot, history: FlightHistory) {
  const day = snapshot.crawledAt.slice(0, 10);
  await Promise.all([
    writeJson(snapshotPath(day), snapshot),
    writeJson(LATEST_PATH, snapshot),
    writeJson(HISTORY_PATH, history),
  ]);
}
