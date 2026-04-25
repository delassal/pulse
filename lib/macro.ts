import type { MacroData, MacroIndicator } from "@/types";
import { csvToObjects, toNumber } from "@/lib/utils";

const ECB_INFLATION_URL =
  "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.ANR?format=csvdata";
const ECB_POLICY_RATE_URL =
  "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_RT.LEV?format=csvdata";

const FRED_CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL";
const FRED_FEDFUNDS_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";
const FRED_VIX_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS";
const FRED_US_10Y_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10";
const FRED_US_2Y_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2";
const FRED_EURUSD_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSEU";
const FRED_OIL_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO";
const FRED_GOLD_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM";
const FRED_PMI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NAPM";

interface SeriesPoint {
  date: string;
  value: number;
}

function pickValue(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

async function fetchCsvSeries(
  url: string,
  dateKeys: string[],
  valueKeys: string[],
): Promise<SeriesPoint[]> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch series: ${url}`);
  }

  const text = await response.text();
  const rows = csvToObjects(text);

  return rows
    .map((row) => {
      const date = pickValue(row, dateKeys);
      const rawValue = pickValue(row, valueKeys);
      const value = toNumber(rawValue);

      if (!date || value === null) {
        return null;
      }

      return { date, value };
    })
    .filter((point): point is SeriesPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function latestWithChange(points: SeriesPoint[]) {
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

function spreadSeries(left: SeriesPoint[], right: SeriesPoint[]): SeriesPoint[] {
  const rightByDate = new Map(right.map((point) => [point.date, point.value]));

  return left
    .map((point) => {
      const rightValue = rightByDate.get(point.date);

      if (rightValue === undefined) {
        return null;
      }

      return {
        date: point.date,
        value: point.value - rightValue,
      };
    })
    .filter((point): point is SeriesPoint => point !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchEcbInflation(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    ECB_INFLATION_URL,
    ["TIME_PERIOD", "DATE"],
    ["OBS_VALUE", "VALUE"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "inflation_euro_area",
    label: "Inflation (Euro Area)",
    value: latest,
    change,
    unit: "%",
  };
}

async function fetchEcbPolicyRate(): Promise<MacroIndicator> {
  try {
    const points = await fetchCsvSeries(
      ECB_POLICY_RATE_URL,
      ["TIME_PERIOD", "DATE"],
      ["OBS_VALUE", "VALUE"],
    );
    const { latest, change } = latestWithChange(points);

    return {
      id: "policy_rate_ecb",
      label: "ECB Policy Rate",
      value: latest,
      change,
      unit: "%",
    };
  } catch {
    const points = await fetchCsvSeries(
      FRED_FEDFUNDS_URL,
      ["observation_date"],
      ["FEDFUNDS"],
    );
    const { latest, change } = latestWithChange(points);

    return {
      id: "policy_rate_fed_fallback",
      label: "Fed Funds Rate (fallback)",
      value: latest,
      change,
      unit: "%",
    };
  }
}

async function fetchUsInflationFallback(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_CPI_URL,
    ["observation_date"],
    ["CPIAUCSL"],
  );

  if (points.length < 13) {
    throw new Error("Insufficient CPI points for YoY inflation");
  }

  const latest = points[points.length - 1].value;
  const priorYear = points[points.length - 13].value;
  const previous = points[points.length - 2].value;
  const previousPriorYear = points[points.length - 14].value;

  const yoy = ((latest - priorYear) / priorYear) * 100;
  const previousYoy = ((previous - previousPriorYear) / previousPriorYear) * 100;

  return {
    id: "inflation_us_fallback",
    label: "Inflation (US, fallback)",
    value: yoy,
    change: yoy - previousYoy,
    unit: "%",
  };
}

async function fetchVix(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_VIX_URL,
    ["observation_date"],
    ["VIXCLS"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "vix",
    label: "Volatility (VIX)",
    value: latest,
    change,
    unit: "idx",
  };
}

async function fetchUs10yYield(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_US_10Y_URL,
    ["observation_date"],
    ["DGS10"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "us_10y_yield",
    label: "US 10Y Yield",
    value: latest,
    change,
    unit: "%",
  };
}

async function fetchEurUsd(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_EURUSD_URL,
    ["observation_date"],
    ["DEXUSEU"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "eur_usd",
    label: "EUR/USD",
    value: latest,
    change,
    unit: "rate",
  };
}

async function fetchOil(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_OIL_URL,
    ["observation_date"],
    ["DCOILWTICO"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "oil_wti",
    label: "Oil (WTI)",
    value: latest,
    change,
    unit: "$",
  };
}

async function fetchGold(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_GOLD_URL,
    ["observation_date"],
    ["GOLDAMGBD228NLBM"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "gold",
    label: "Gold",
    value: latest,
    change,
    unit: "$",
  };
}

async function fetchPmi(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    FRED_PMI_URL,
    ["observation_date"],
    ["NAPM"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    id: "pmi",
    label: "PMI (US ISM)",
    value: latest,
    change,
    unit: "idx",
  };
}

async function fetchYieldCurve(): Promise<MacroIndicator> {
  const [longTerm, shortTerm] = await Promise.all([
    fetchCsvSeries(FRED_US_10Y_URL, ["observation_date"], ["DGS10"]),
    fetchCsvSeries(FRED_US_2Y_URL, ["observation_date"], ["DGS2"]),
  ]);

  const spreads = spreadSeries(longTerm, shortTerm);
  const { latest, change } = latestWithChange(spreads);

  return {
    id: "yield_curve_10y_2y",
    label: "Yield Curve (10Y-2Y)",
    value: latest,
    change,
    unit: "pp",
  };
}

function fulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

function hasAnyFailure<T>(results: PromiseSettledResult<T>[]) {
  return results.some((result) => result.status === "rejected");
}

export async function getMacroData(): Promise<MacroData> {
  const sources = new Set<string>();

  let inflation: MacroIndicator;
  try {
    inflation = await fetchEcbInflation();
    sources.add("ECB");
  } catch {
    inflation = await fetchUsInflationFallback();
    sources.add("FRED");
  }

  const [policyRateResult, marketsTodayResults, macroContextResults] = await Promise.all(
    [
    fetchEcbPolicyRate(),
    Promise.allSettled([
      fetchVix(),
      fetchUs10yYield(),
      fetchEurUsd(),
      fetchOil(),
      fetchGold(),
    ]),
    Promise.allSettled([fetchPmi(), fetchYieldCurve()]),
  ],
  );

  const marketsToday = fulfilledValues(marketsTodayResults);
  if (marketsToday.length === 0) {
    throw new Error("Failed to fetch market indicators");
  }

  sources.add("FRED");

  const macroEnvironment = [
    inflation,
    policyRateResult,
    ...fulfilledValues(macroContextResults),
  ];

  if (hasAnyFailure(marketsTodayResults) || hasAnyFailure(macroContextResults)) {
    sources.add("FRED");
  }

  sources.add(policyRateResult.label.includes("ECB") ? "ECB" : "FRED");

  return {
    marketsToday,
    macroEnvironment,
    indicators: [...marketsToday, ...macroEnvironment],
    updatedAt: new Date().toISOString(),
    sources: Array.from(sources),
  };
}
