// Russia inflation + key rate, scraped from the Central Bank of Russia (CBR)
// HTML pages. Fragile by nature — callers fall back to FRED proxies on failure.

import type { MacroIndicator } from "@/types";
import { toNumber } from "@/lib/utils";
import {
  CBR_INFLATION_URL,
  CBR_KEY_RATE_URL,
  FETCH_START_DATE,
  MACRO_HISTORY_POINTS,
} from "@/lib/macro/constants";
import { buildIndicator, type SeriesPoint } from "@/lib/macro/series";

function toCbrDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function parseCbrDate(value: string) {
  const [day, month, year] = value.split(".");

  if (!day || !month || !year) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseCbrMonthYear(value: string) {
  const [month, year] = value.split(".");

  if (!month || !year) {
    return null;
  }

  return `${year}-${month}-01`;
}

export async function fetchRussiaDepositFacilityProxy(): Promise<MacroIndicator> {
  const from = toCbrDate(FETCH_START_DATE);
  const to = toCbrDate(new Date().toISOString().slice(0, 10));
  const url = `${CBR_KEY_RATE_URL}&UniDbQuery.From=${from}&UniDbQuery.To=${to}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch CBR key rate series");
  }

  const html = await response.text();
  const rowRegex = /<td>(\d{2}\.\d{2}\.\d{4})<\/td>\s*<td>([\d,]+)<\/td>/g;
  const points: SeriesPoint[] = [];
  let match = rowRegex.exec(html);

  while (match) {
    const isoDate = parseCbrDate(match[1]);
    const value = toNumber(match[2].replace(",", "."));

    if (isoDate && value !== null && isoDate >= FETCH_START_DATE) {
      points.push({ date: isoDate, value });
    }

    match = rowRegex.exec(html);
  }

  const sortedPoints = points.sort((a, b) => a.date.localeCompare(b.date));

  if (sortedPoints.length < 2) {
    throw new Error("Insufficient CBR key rate points");
  }

  return buildIndicator(
    "policy_rate_russia",
    "Deposit Facility (CBR proxy)",
    "%",
    sortedPoints,
    MACRO_HISTORY_POINTS,
  );
}

export async function fetchRussiaInflationProxy(): Promise<MacroIndicator> {
  const from = toCbrDate(FETCH_START_DATE);
  const to = toCbrDate(new Date().toISOString().slice(0, 10));
  const url = `${CBR_INFLATION_URL}&UniDbQuery.From=${encodeURIComponent(from)}&UniDbQuery.To=${encodeURIComponent(to)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch CBR inflation series");
  }

  const html = await response.text();
  const inflationSeriesIndex = html.indexOf('"name":"Инфляция, % г/г"');

  if (inflationSeriesIndex < 0) {
    throw new Error("Missing CBR inflation series");
  }

  const xAxisStart = html.lastIndexOf('"xAxis":{"type":"category"', inflationSeriesIndex);
  if (xAxisStart < 0) {
    throw new Error("Missing CBR inflation categories");
  }

  const xAxisEnd = html.indexOf(',"yAxis"', xAxisStart);
  if (xAxisEnd < 0) {
    throw new Error("Missing CBR inflation category end");
  }

  const categoriesSlice = html.slice(xAxisStart, xAxisEnd);
  const monthMatches = categoriesSlice.match(/"\d{2}\.\d{4}"/g) ?? [];
  const months = monthMatches
    .map((match) => match.replace(/"/g, ""))
    .map((monthYear) => parseCbrMonthYear(monthYear))
    .filter((value): value is string => value !== null);

  const dataToken = '"data":[';
  const dataStart = html.lastIndexOf(dataToken, inflationSeriesIndex);
  if (dataStart < 0) {
    throw new Error("Missing CBR inflation data");
  }

  const dataValuesStart = dataStart + dataToken.length;
  const dataEnd = html.indexOf('],"color"', dataValuesStart);
  if (dataEnd < 0) {
    throw new Error("Missing CBR inflation data end");
  }

  const dataRaw = html.slice(dataValuesStart, dataEnd);
  const values = dataRaw.split(",").map((value) => {
    const trimmed = value.trim();

    if (trimmed === "null" || trimmed === "") {
      return null;
    }

    return toNumber(trimmed);
  });

  const monthlyValues = new Map<string, number>();
  for (let index = 0; index < Math.min(months.length, values.length); index += 1) {
    const month = months[index];
    const value = values[index];

    if (value !== null) {
      monthlyValues.set(month, value);
    }
  }

  const points = Array.from(monthlyValues.entries())
    .map(([date, value]) => ({ date, value }))
    .filter((point) => point.date >= FETCH_START_DATE)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    throw new Error("Insufficient CBR inflation points");
  }

  return buildIndicator(
    "inflation_russia",
    "Inflation (CBR proxy)",
    "%",
    points,
    MACRO_HISTORY_POINTS,
  );
}
