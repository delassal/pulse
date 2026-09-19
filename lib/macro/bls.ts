// US CPI inflation sourced from the BLS public API.

import type { MacroIndicator } from "@/types";
import { toNumber } from "@/lib/utils";
import {
  BLS_US_CPI_URL,
  FETCH_START_DATE,
  MACRO_HISTORY_POINTS,
} from "@/lib/macro/constants";
import { buildIndicator, type SeriesPoint, toYoySeries } from "@/lib/macro/series";

export async function fetchUsInflation(): Promise<MacroIndicator> {
  const currentYear = String(new Date().getUTCFullYear());
  const response = await fetch(BLS_US_CPI_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      seriesid: ["CUSR0000SA0"],
      startyear: FETCH_START_DATE.slice(0, 4),
      endyear: currentYear,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch BLS CPI series");
  }

  const payload = (await response.json()) as {
    status?: string;
    Results?: {
      series?: Array<{
        data?: Array<{ year?: string; period?: string; value?: string }>;
      }>;
    };
  };

  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error("BLS CPI request did not succeed");
  }

  const data = payload.Results?.series?.[0]?.data ?? [];

  const points = data
    .map((entry) => {
      const year = entry.year;
      const period = entry.period;
      const value = toNumber(entry.value);

      if (!year || !period || value === null || !period.startsWith("M") || period === "M13") {
        return null;
      }

      const month = period.slice(1).padStart(2, "0");
      const date = `${year}-${month}-01`;

      if (date < FETCH_START_DATE) {
        return null;
      }

      return { date, value };
    })
    .filter((point): point is SeriesPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const yoySeries = toYoySeries(points);

  return buildIndicator(
    "inflation_us",
    "Inflation (BLS CPI)",
    "%",
    yoySeries,
    MACRO_HISTORY_POINTS,
  );
}
