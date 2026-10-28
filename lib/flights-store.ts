import { get, put } from "@vercel/blob";
import type { FlightHistory, FlightSnapshot } from "@/types";

/**
 * Persistence for the flight crawler in a private Vercel Blob store.
 * Needs BLOB_READ_WRITE_TOKEN, which Vercel sets once a Blob store is connected to the project.
 *
 * flights/latest.json              newest snapshot (read by /api/flights)
 * flights/history.json             cheapest fare per destination per day
 * flights/snapshots/YYYY-MM-DD.json  daily archive of full snapshots
 */

const LATEST_PATH = "flights/latest.json";
const HISTORY_PATH = "flights/history.json";
const snapshotPath = (day: string) => `flights/snapshots/${day}.json`;

export function isFlightStoreConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function readJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return (await new Response(result.stream).json()) as T;
}

async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

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
