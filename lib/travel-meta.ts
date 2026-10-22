import type { TravelCountry, TravelSeverity, TravelSourceId } from "@/types";

/** Client-safe labels and helpers for the travel advisory views. */

export type TravelView = TravelSourceId | "max";

export const TRAVEL_VIEWS: Array<{ id: TravelView; label: string; short: string }> = [
  { id: "de", label: "Germany", short: "DE" },
  { id: "us", label: "United States", short: "US" },
  { id: "ca", label: "Canada", short: "CA" },
  { id: "max", label: "Strictest", short: "Max" },
];

export const SOURCE_LABELS: Record<TravelSourceId, string> = {
  de: "Germany · Auswärtiges Amt",
  us: "United States · State Dept.",
  ca: "Canada · Global Affairs",
};

/** Legend per view. Germany only publishes three states, so level 2 is absent. */
export const LEGENDS: Record<TravelView, Array<{ severity: TravelSeverity; label: string }>> = {
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
  max: [
    { severity: 4, label: "Do not travel (any source)" },
    { severity: 3, label: "Reconsider / partial" },
    { severity: 2, label: "Increased caution" },
    { severity: 1, label: "Normal" },
  ],
};

export const SEVERITY_COLOR: Record<TravelSeverity | 0, string> = {
  0: "var(--sev-none)",
  1: "var(--sev-1)",
  2: "var(--sev-2)",
  3: "var(--sev-3)",
  4: "var(--sev-4)",
};

export function severityFor(country: TravelCountry | undefined, view: TravelView): TravelSeverity | 0 {
  if (!country) return 0;
  if (view !== "max") return country.advisories[view]?.severity ?? 0;

  const levels = Object.values(country.advisories).map((advisory) => advisory.severity);
  return levels.length ? (Math.max(...levels) as TravelSeverity) : 0;
}

/** Difference between the strictest and the mildest source for one country. */
export function severitySpread(country: TravelCountry): number {
  const levels = Object.values(country.advisories).map((advisory) => advisory.severity);
  if (levels.length < 2) return 0;
  return Math.max(...levels) - Math.min(...levels);
}
