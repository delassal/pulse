import { isBlobStoreConfigured, readJson, writeJson } from "@/lib/blob-store";
import type { TravelHistoryState } from "@/lib/travel-changes";
import seed from "@/data/travel-history-seed.json";

/**
 * Persistence for the advisory level history (see lib/blob-store.ts).
 *
 * travel/history.json   last level on record per source and country, plus the change log
 *
 * Until the first daily run has written that file, the history starts from the seed in
 * data/: US changes since Nov 2025 and Canadian ones since Jul 2026, reconstructed from
 * Internet Archive copies of the feeds, and all four sources' levels as of 14 Nov 2026.
 */

const HISTORY_PATH = "travel/history.json";

export const isTravelStoreConfigured = isBlobStoreConfigured;

export async function readTravelHistory(): Promise<TravelHistoryState> {
  const stored = isBlobStoreConfigured()
    ? await readJson<TravelHistoryState>(HISTORY_PATH)
    : null;
  return stored ?? (seed as unknown as TravelHistoryState);
}

export function saveTravelHistory(state: TravelHistoryState) {
  return writeJson(HISTORY_PATH, state);
}
