import type { MacroData, MacroIndicator, MacroRegionContext } from "@/types";
import { csvToObjects, toNumber } from "@/lib/utils";

const FRED_VIX_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS";
const FRED_EURUSD_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSEU";
const FRED_OIL_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO";
const FRED_GOLD_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM";
const FRED_PMI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NAPM";
const FRED_FEDFUNDS_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";

const FRED_INFLATION_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CP0000EZ19M086NEST";
const FRED_INFLATION_UK_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01GBM657N";
const FRED_INFLATION_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01USM657N";
const FRED_INFLATION_RU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01RUM657N";
const FRED_INFLATION_CN_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01CNM657N";

const FRED_DEPOSIT_FACILITY_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=ECBDFR";
const FRED_DEPOSIT_FACILITY_UK_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01GBM156N";
const FRED_DEPOSIT_FACILITY_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB";
const FRED_DEPOSIT_FACILITY_RU_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01RUM156N";
const FRED_DEPOSIT_FACILITY_CN_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01CNM156N";

const FETCH_START_DATE = "2019-01-01";
const DISPLAY_START_DATE = "2020-01-01";
const MARKET_HISTORY_POINTS = 40;
const MACRO_HISTORY_POINTS = 3000;

type RegionId = "eu" | "uk" | "us" | "russia" | "china";

interface SeriesPoint {
  date: string;
  value: number;
}

interface RegionSeriesConfig {
  id: RegionId;
  label: string;
  inflationUrl: string;
  depositFacilityUrl: string;
}

const REGION_SERIES_CONFIGS: RegionSeriesConfig[] = [
  {
    id: "eu",
    label: "EU",
    inflationUrl: FRED_INFLATION_EU_URL,
    depositFacilityUrl: FRED_DEPOSIT_FACILITY_EU_URL,
  },
  {
    id: "uk",
    label: "UK",
    inflationUrl: FRED_INFLATION_UK_URL,
    depositFacilityUrl: FRED_DEPOSIT_FACILITY_UK_PROXY_URL,
  },
  {
    id: "us",
    label: "US",
    inflationUrl: FRED_INFLATION_US_URL,
    depositFacilityUrl: FRED_DEPOSIT_FACILITY_US_URL,
  },
  {
    id: "russia",
    label: "Russia",
    inflationUrl: FRED_INFLATION_RU_URL,
    depositFacilityUrl: FRED_DEPOSIT_FACILITY_RU_PROXY_URL,
  },
  {
    id: "china",
    label: "China",
    inflationUrl: FRED_INFLATION_CN_URL,
    depositFacilityUrl: FRED_DEPOSIT_FACILITY_CN_PROXY_URL,
  },
];

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

async function fetchCsvSeries(url: string): Promise<SeriesPoint[]> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch series: ${url}`);
  }

  const text = await response.text();
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

function toHistory(points: SeriesPoint[], maxPoints: number) {
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

function buildIndicator(
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

function toYoySeries(points: SeriesPoint[]) {
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

function mergeRegionHistory(
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

async function fetchRegionalInflation(config: RegionSeriesConfig): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(config.inflationUrl);

  if (config.id === "eu") {
    const yoySeries = toYoySeries(points);

    return buildIndicator(
      `inflation_${config.id}`,
      "Inflation",
      "%",
      yoySeries,
      MACRO_HISTORY_POINTS,
    );
  }

  return buildIndicator(
    `inflation_${config.id}`,
    "Inflation",
    "%",
    points,
    MACRO_HISTORY_POINTS,
  );
}

async function fetchRegionalPolicyRate(config: RegionSeriesConfig): Promise<MacroIndicator> {
  if (config.id === "us") {
    return fetchUsDepositFacility();
  }

  const points = await fetchCsvSeries(config.depositFacilityUrl);

  return buildIndicator(
    `policy_rate_${config.id}`,
    "Deposit Facility",
    "%",
    points,
    MACRO_HISTORY_POINTS,
  );
}

async function fetchUsDepositFacility(): Promise<MacroIndicator> {
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

async function fetchRegionContext(config: RegionSeriesConfig): Promise<MacroRegionContext> {
  const [inflation, policyRate] = await Promise.all([
    fetchRegionalInflation(config),
    fetchRegionalPolicyRate(config),
  ]);

  if (!inflation.history || !policyRate.history) {
    throw new Error(`Missing regional history for ${config.label}`);
  }

  return {
    id: config.id,
    label: config.label,
    inflation,
    policyRate,
    history: mergeRegionHistory(inflation.history, policyRate.history),
  };
}

async function fetchVix(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_VIX_URL);
  return buildIndicator("vix", "Volatility (VIX)", "idx", points, MARKET_HISTORY_POINTS);
}

async function fetchEurUsd(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_EURUSD_URL);
  return buildIndicator("eur_usd", "EUR/USD", "rate", points, MARKET_HISTORY_POINTS);
}

async function fetchOil(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_OIL_URL);
  return buildIndicator("oil_wti", "Oil (WTI)", "$", points, MARKET_HISTORY_POINTS);
}

async function fetchGold(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_GOLD_URL);
  return buildIndicator("gold", "Gold", "$", points, MARKET_HISTORY_POINTS);
}

async function fetchPmi(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_PMI_URL);
  return buildIndicator("pmi", "PMI (US ISM)", "idx", points, MACRO_HISTORY_POINTS);
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
  const [marketsTodayResults, regionResults, macroContextResults] = await Promise.all([
    Promise.allSettled([fetchVix(), fetchEurUsd(), fetchOil(), fetchGold()]),
    Promise.allSettled(REGION_SERIES_CONFIGS.map((config) => fetchRegionContext(config))),
    Promise.allSettled([fetchPmi()]),
  ]);

  const marketsToday = fulfilledValues(marketsTodayResults);
  if (marketsToday.length === 0) {
    throw new Error("Failed to fetch market indicators");
  }

  const regions = fulfilledValues(regionResults);
  if (regions.length === 0) {
    throw new Error("Failed to fetch regional macro context");
  }

  const macroEnvironment = [
    ...regions.flatMap((region) => [region.inflation, region.policyRate]),
    ...fulfilledValues(macroContextResults),
  ];

  const hadFailures =
    hasAnyFailure(marketsTodayResults)
    || hasAnyFailure(regionResults)
    || hasAnyFailure(macroContextResults);

  return {
    marketsToday,
    regions,
    macroEnvironment,
    indicators: [...marketsToday, ...macroEnvironment],
    updatedAt: new Date().toISOString(),
    sources: hadFailures ? ["FRED (partial)"] : ["FRED"],
  };
}
