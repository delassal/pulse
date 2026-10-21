// FRED (Federal Reserve Economic Data) CSV series + the market/PMI indicators
// and the US deposit-facility rate that are sourced from it.

import type { MacroIndicator } from "@/types";
import { csvToObjects, toNumber } from "@/lib/utils";
import {
  FETCH_START_DATE,
  FRED_DEPOSIT_FACILITY_US_URL,
  FRED_EURUSD_URL,
  FRED_FEDFUNDS_URL,
  FRED_GOLD_URL,
  FRED_OIL_URL,
  FRED_PMI_URL,
  FRED_VIX_URL,
  MACRO_HISTORY_POINTS,
  MARKET_HISTORY_POINTS,
} from "@/lib/macro/constants";
import { buildIndicator, type SeriesPoint } from "@/lib/macro/series";

function pickValue(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function getSeriesKey(url: string) {
  const parsed = new URL(url);
  const seriesId = parsed.searchParams.get("id");

  if (!seriesId) {
    throw new Error(`Missing FRED series id in URL: ${url}`);
  }

  return seriesId;
}

export async function fetchCsvSeries(url: string): Promise<SeriesPoint[]> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch series: ${url}`);
  }

  const text = await response.text();

  // FRED serves its maintenance page with HTTP 200, so `response.ok` alone
  // doesn't catch it — detect HTML instead of CSV.
  if (text.trimStart().startsWith("<")) {
    throw new Error("FRED is under maintenance (returned HTML instead of CSV)");
  }

  const rows = csvToObjects(text);
  const seriesKey = getSeriesKey(url);
  const seriesEndDate = new Date().toISOString().slice(0, 10);

  return rows
    .map((row) => {
      const date = pickValue(row, ["observation_date", "TIME_PERIOD", "DATE"]);
      const rawValue = pickValue(row, [seriesKey, "OBS_VALUE", "VALUE"]);
      const value = toNumber(rawValue);

      if (!date || value === null) {
        return null;
      }

      if (date < FETCH_START_DATE || date > seriesEndDate) {
        return null;
      }

      return { date, value };
    })
    .filter((point): point is SeriesPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchUsDepositFacility(): Promise<MacroIndicator> {
  const [iorbPoints, fedFundsPoints] = await Promise.all([
    fetchCsvSeries(FRED_DEPOSIT_FACILITY_US_URL),
    fetchCsvSeries(FRED_FEDFUNDS_URL),
  ]);

  if (iorbPoints.length < 2 && fedFundsPoints.length < 2) {
    throw new Error("Insufficient US deposit facility points");
  }

  const firstIorbDate = iorbPoints[0]?.date;
  const preIorbPoints = firstIorbDate
    ? fedFundsPoints.filter((point) => point.date < firstIorbDate)
    : fedFundsPoints;

  const combinedPoints = [...preIorbPoints, ...iorbPoints].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return buildIndicator(
    "policy_rate_us",
    "Deposit Facility",
    "%",
    combinedPoints,
    MACRO_HISTORY_POINTS,
  );
}

export async function fetchVix(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_VIX_URL);
  return buildIndicator("vix", "Volatility (VIX)", "idx", points, MARKET_HISTORY_POINTS);
}

export async function fetchEurUsd(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_EURUSD_URL);
  return buildIndicator("eur_usd", "EUR/USD", "rate", points, MARKET_HISTORY_POINTS);
}

export async function fetchOil(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_OIL_URL);
  return buildIndicator("oil_wti", "Oil (WTI)", "$", points, MARKET_HISTORY_POINTS);
}

export async function fetchGold(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_GOLD_URL);
  return buildIndicator("gold", "Gold", "$", points, MARKET_HISTORY_POINTS);
}

export async function fetchPmi(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_PMI_URL);
  return buildIndicator("pmi", "PMI (US ISM)", "idx", points, MACRO_HISTORY_POINTS);
}
