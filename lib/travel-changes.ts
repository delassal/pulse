import type {
  TravelAdvisoryData,
  TravelChange,
  TravelSeverity,
  TravelSourceId,
} from "@/types";

/**
 * Level-change tracking for the travel advisories. The sources only publish their current
 * level, so history comes from comparing each day's levels with the last ones on record.
 * Pure functions; persistence lives in lib/travel-store.ts.
 */

/** Last level on record: [severity, label as published]. */
export type TravelLevel = [TravelSeverity, string];

export interface TravelHistoryState {
  /** Last comparison run, ISO timestamp. */
  checkedAt: string | null;
  /** First day each source was recorded, YYYY-MM-DD. */
  trackingSince: Partial<Record<TravelSourceId, string>>;
  /** When each source's levels below were captured, ISO timestamp. */
  levelsAt: Partial<Record<TravelSourceId, string>>;
  levels: Partial<Record<TravelSourceId, Record<string, TravelLevel>>>;
  /** Differing levels seen in the latest run only, waiting for a second run to confirm them. */
  pending?: Partial<Record<TravelSourceId, Record<string, { level: TravelLevel; date: string }>>>;
  /** Newest first. */
  changes: TravelChange[];
}

// A source re-rating this many countries in one day is far likelier a feed or parser
// problem than news, so such a run is not recorded and the old levels stay on record.
const MAX_CHANGES_PER_RUN = 40;
const MAX_CHANGES_KEPT = 3000;

export function emptyTravelHistory(): TravelHistoryState {
  return { checkedAt: null, trackingSince: {}, levelsAt: {}, levels: {}, changes: [] };
}

export interface TrackResult {
  state: TravelHistoryState;
  added: TravelChange[];
  /** Sources left untouched: unavailable today, or with an implausible number of changes. */
  skipped: TravelSourceId[];
}

/**
 * Compares today's advisories with the levels on record and returns the updated state.
 *
 * With `confirm` (the default, meant for daily runs) a new level only counts once two
 * consecutive runs agree on it: the feeds occasionally publish a wrong level for a day
 * (the US feed once listed Lebanon as Level 1 between two Level 4 entries). The change
 * is still dated to the day it was first published or seen.
 */
export function trackTravelChanges(
  previous: TravelHistoryState | null,
  data: TravelAdvisoryData,
  now = new Date(),
  { confirm = true }: { confirm?: boolean } = {},
): TrackResult {
  const base = previous ?? emptyTravelHistory();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);

  const state: TravelHistoryState = {
    checkedAt: nowIso,
    trackingSince: { ...base.trackingSince },
    levelsAt: { ...base.levelsAt },
    levels: { ...base.levels },
    pending: { ...base.pending },
    changes: base.changes,
  };
  const added: TravelChange[] = [];
  const skipped: TravelSourceId[] = [];

  for (const source of data.sources) {
    if (!source.ok) {
      skipped.push(source.id);
      continue;
    }

    const known = base.levels[source.id] ?? {};
    const knownAt = base.levelsAt[source.id];
    const wasPending = base.pending?.[source.id] ?? {};
    // Countries missing from today's feed keep their last level on record.
    const levels: Record<string, TravelLevel> = { ...known };
    const pending: Record<string, { level: TravelLevel; date: string }> = {};
    const changes: TravelChange[] = [];
    let differing = 0;

    for (const country of data.countries) {
      const advisory = country.advisories[source.id];
      if (!advisory) continue;

      const current: TravelLevel = [advisory.severity, advisory.label];
      const before = known[country.iso2];
      if (!before || before[0] === advisory.severity) {
        levels[country.iso2] = current;
        continue;
      }
      differing += 1;

      const seenBefore = wasPending[country.iso2];
      if (confirm && seenBefore?.level[0] !== advisory.severity) {
        // The source's own publication date when it falls after the levels on record;
        // otherwise the page was last edited earlier and the change is dated to this run.
        const published = advisory.updatedAt;
        const date =
          published && published <= nowIso && (!knownAt || published > knownAt)
            ? published.slice(0, 10)
            : today;
        pending[country.iso2] = { level: current, date };
        continue;
      }

      const published = advisory.updatedAt;
      const date =
        seenBefore?.date ??
        (published && published <= nowIso && (!knownAt || published > knownAt)
          ? published.slice(0, 10)
          : today);

      levels[country.iso2] = current;
      changes.push({
        date,
        iso2: country.iso2,
        name: country.name,
        source: source.id,
        from: before[0],
        to: advisory.severity,
        fromLabel: before[1],
        toLabel: advisory.label,
      });
    }

    if (differing > MAX_CHANGES_PER_RUN) {
      skipped.push(source.id);
      continue;
    }

    state.levels[source.id] = levels;
    state.pending![source.id] = pending;
    state.levelsAt[source.id] = nowIso;
    state.trackingSince[source.id] ??= today;
    added.push(...changes);
  }

  if (added.length > 0) {
    state.changes = [...added, ...base.changes]
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "en"))
      .slice(0, MAX_CHANGES_KEPT);
  }

  return { state, added, skipped };
}
