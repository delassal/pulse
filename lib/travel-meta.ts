import type { TravelCountry, TravelSeverity, TravelSourceId } from "@/types";

/** Client-safe labels and helpers for the travel advisory views. */

export const TRAVEL_VIEWS: Array<{ id: TravelSourceId; label: string; short: string }> = [
  { id: "de", label: "Germany", short: "DE" },
  { id: "us", label: "United States", short: "US" },
  { id: "ca", label: "Canada", short: "CA" },
  { id: "uk", label: "United Kingdom", short: "UK" },
];

export const SOURCE_ORDER: TravelSourceId[] = TRAVEL_VIEWS.map((view) => view.id);

export const SOURCE_LABELS: Record<TravelSourceId, string> = {
  de: "Germany · Auswärtiges Amt",
  us: "United States · State Dept.",
  ca: "Canada · Global Affairs",
  uk: "United Kingdom · FCDO",
};

/** ISO numeric code (the world map's shape id) of the country issuing each source. */
export const SOURCE_HOME: Record<TravelSourceId, string> = {
  de: "276",
  us: "840",
  ca: "124",
  uk: "826",
};

/** Legend per view. Germany only publishes three states, so level 2 is absent. */
export const LEGENDS: Record<TravelSourceId, Array<{ severity: TravelSeverity; label: string }>> = {
  de: [
    { severity: 4, label: "Travel warning" },
    { severity: 3, label: "Partial travel warning" },
    { severity: 1, label: "No warning" },
  ],
  us: [
    { severity: 4, label: "Do not travel" },
    { severity: 3, label: "Reconsider travel" },
    { severity: 2, label: "Increased caution" },
    { severity: 1, label: "Normal precautions" },
  ],
  ca: [
    { severity: 4, label: "Avoid all travel" },
    { severity: 3, label: "Avoid non-essential travel" },
    { severity: 2, label: "High degree of caution" },
    { severity: 1, label: "Normal precautions" },
  ],
  uk: [
    { severity: 4, label: "Against all travel" },
    { severity: 3, label: "Against all but essential travel, or all travel to parts" },
    { severity: 2, label: "Against all but essential travel to parts" },
    { severity: 1, label: "No advice against travel" },
  ],
};

export const SEVERITY_COLOR: Record<TravelSeverity | 0, string> = {
  0: "var(--sev-none)",
  1: "var(--sev-1)",
  2: "var(--sev-2)",
  3: "var(--sev-3)",
  4: "var(--sev-4)",
};

export function severityFor(
  country: TravelCountry | undefined,
  source: TravelSourceId,
): TravelSeverity | 0 {
  return country?.advisories[source]?.severity ?? 0;
}

function severities(country: TravelCountry): number[] {
  return Object.values(country.advisories).map((advisory) => advisory.severity);
}

/** Strictest level any source publishes for one country. */
export function maxSeverity(country: TravelCountry): TravelSeverity | 0 {
  const levels = severities(country);
  return levels.length ? (Math.max(...levels) as TravelSeverity) : 0;
}

/** Difference between the strictest and the mildest source for one country. */
export function severitySpread(country: TravelCountry): number {
  const levels = severities(country);
  if (levels.length < 2) return 0;
  return Math.max(...levels) - Math.min(...levels);
}
