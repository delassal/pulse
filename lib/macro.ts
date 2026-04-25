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
const BLS_US_CPI_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

const FRED_INFLATION_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CP0000EZ19M086NEST";
const FRED_INFLATION_UK_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GBRCPIALLMINMEI";
const FRED_INFLATION_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=USACPIALLMINMEI";
const FRED_INFLATION_RU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01RUM657N";
const FRED_INFLATION_CN_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CHNCPIALLMINMEI";

const FRED_DEPOSIT_FACILITY_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=ECBDFR";
const FRED_DEPOSIT_FACILITY_UK_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01GBM156N";
const FRED_DEPOSIT_FACILITY_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB";
const FRED_DEPOSIT_FACILITY_RU_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01RUM156N";
const FRED_DEPOSIT_FACILITY_CN_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IR3TIB01CNM156N";
const CBR_KEY_RATE_URL =
  "https://www.cbr.ru/hd_base/KeyRate/?UniDbQuery.Posted=True";
const CBR_INFLATION_URL =
  "https://www.cbr.ru/hd_base/infl/?UniDbQuery.Posted=True";

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
  if (config.id === "us") {
    try {
      return await fetchUsInflation();
    } catch {
      const fallbackPoints = await fetchCsvSeries(config.inflationUrl);

      return buildIndicator(
        `inflation_${config.id}`,
        "Inflation (FRED proxy)",
        "%",
        toYoySeries(fallbackPoints),
        MACRO_HISTORY_POINTS,
      );
    }
  }

  if (config.id === "russia") {
    try {
      return await fetchRussiaInflationProxy();
    } catch {
      const fallbackPoints = await fetchCsvSeries(config.inflationUrl);

      return buildIndicator(
        `inflation_${config.id}`,
        "Inflation (FRED proxy)",
        "%",
        fallbackPoints,
        MACRO_HISTORY_POINTS,
      );
    }
  }

  const points = await fetchCsvSeries(config.inflationUrl);

  const yoySeries = toYoySeries(points);

  return buildIndicator(
    `inflation_${config.id}`,
    "Inflation",
    "%",
    yoySeries,
    MACRO_HISTORY_POINTS,
  );
}

async function fetchRegionalPolicyRate(config: RegionSeriesConfig): Promise<MacroIndicator> {
  if (config.id === "us") {
    return fetchUsDepositFacility();
  }

  if (config.id === "russia") {
    try {
      return await fetchRussiaDepositFacilityProxy();
    } catch {
      const fallbackPoints = await fetchCsvSeries(config.depositFacilityUrl);

      return buildIndicator(
        `policy_rate_${config.id}`,
        "Deposit Facility (FRED proxy)",
        "%",
        fallbackPoints,
        MACRO_HISTORY_POINTS,
      );
    }
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

async function fetchUsInflation(): Promise<MacroIndicator> {
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

async function fetchRussiaDepositFacilityProxy(): Promise<MacroIndicator> {
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

async function fetchRussiaInflationProxy(): Promise<MacroIndicator> {
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

  const sources = new Set<string>(["FRED"]);
  const usesBls = regions.some((region) =>
    region.inflation.label.includes("BLS"),
  );
  const usesCbr = regions.some(
    (region) =>
      region.policyRate.label.includes("CBR")
      || region.inflation.label.includes("CBR"),
  );

  if (usesBls) {
    sources.add("BLS");
  }

  if (usesCbr) {
    sources.add("CBR");
  }

  if (hadFailures) {
    sources.add("partial");
  }

  return {
    marketsToday,
    regions,
    macroEnvironment,
    indicators: [...marketsToday, ...macroEnvironment],
    updatedAt: new Date().toISOString(),
    sources: Array.from(sources),
  };
}
