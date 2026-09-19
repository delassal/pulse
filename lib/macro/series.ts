// Pure series math shared across the macro data sources: no fetching here.

import type { MacroIndicator } from "@/types";
import { DISPLAY_START_DATE, MACRO_HISTORY_POINTS } from "@/lib/macro/constants";

export interface SeriesPoint {
  date: string;
  value: number;
}

export function latestWithChange(points: SeriesPoint[]) {
  if (points.length < 2) {
    throw new Error("Insufficient series points");
  }

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  return {
    latest: latest.value,
    change: latest.value - previous.value,
  };
}

export function toHistory(points: SeriesPoint[], maxPoints: number) {
  const seriesEndDate = new Date().toISOString().slice(0, 10);

  return points
    .filter(
      (point) => point.date >= DISPLAY_START_DATE && point.date <= seriesEndDate,
    )
    .slice(-maxPoints)
    .map((point) => ({
      date: point.date,
      value: point.value,
    }));
}

export function buildIndicator(
  id: string,
  label: string,
  unit: string,
  points: SeriesPoint[],
  maxHistoryPoints: number,
): MacroIndicator {
  const { latest, change } = latestWithChange(points);

  return {
    id,
    label,
    value: latest,
    change,
    unit,
    history: toHistory(points, maxHistoryPoints),
  };
}

export function toYoySeries(points: SeriesPoint[]) {
  return points
    .map((point, index) => {
      const priorYear = points[index - 12];

      if (!priorYear || priorYear.value === 0) {
        return null;
      }

      return {
        date: point.date,
        value: ((point.value - priorYear.value) / priorYear.value) * 100,
      };
    })
    .filter((point): point is SeriesPoint => point !== null);
}

export function mergeRegionHistory(
  inflationHistory: NonNullable<MacroIndicator["history"]>,
  policyHistory: NonNullable<MacroIndicator["history"]>,
) {
  const inflationByMonth = new Map(
    inflationHistory.map((point) => [point.date.slice(0, 7), point.value]),
  );
  const policyByMonth = new Map(
    policyHistory.map((point) => [point.date.slice(0, 7), point.value]),
  );

  const seriesEndDate = new Date().toISOString().slice(0, 10);
  const start = new Date(`${DISPLAY_START_DATE}T00:00:00`);
  const end = new Date(`${seriesEndDate}T00:00:00`);

  let lastInflation: number | undefined;
  let lastPolicyRate: number | undefined;
  const merged: Array<{ date: string; inflation: number; policyRate: number }> = [];

  const cursor = new Date(start);

  while (cursor <= end) {
    const monthKey = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const inflation = inflationByMonth.get(monthKey);
    const policyRate = policyByMonth.get(monthKey);

    if (inflation !== undefined) {
      lastInflation = inflation;
    }

    if (policyRate !== undefined) {
      lastPolicyRate = policyRate;
    }

    if (lastInflation !== undefined && lastPolicyRate !== undefined) {
      merged.push({
        date: `${monthKey}-01`,
        inflation: lastInflation,
        policyRate: lastPolicyRate,
      });
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return merged.slice(-MACRO_HISTORY_POINTS);
}
