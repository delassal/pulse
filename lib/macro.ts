import type { MacroData, MacroIndicator } from "@/types";
import { csvToObjects, toNumber } from "@/lib/utils";

const ECB_INFLATION_URL =
  "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.ANR?format=csvdata";
const ECB_POLICY_RATE_URL =
  "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_RT.LEV?format=csvdata";

const FRED_CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL";
const FRED_FEDFUNDS_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";

interface SeriesPoint {
  date: string;
  value: number;
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
      const date = dateKeys.map((key) => row[key]).find(Boolean);
      const rawValue = valueKeys.map((key) => row[key]).find(Boolean);
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

async function fetchEcbInflation(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    ECB_INFLATION_URL,
    ["TIME_PERIOD", "DATE"],
    ["OBS_VALUE", "VALUE"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    label: "Inflation (Euro Area)",
    value: latest,
    change,
    unit: "%",
  };
}

async function fetchEcbPolicyRate(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(
    ECB_POLICY_RATE_URL,
    ["TIME_PERIOD", "DATE"],
    ["OBS_VALUE", "VALUE"],
  );
  const { latest, change } = latestWithChange(points);

  return {
    label: "ECB Policy Rate",
    value: latest,
    change,
    unit: "%",
  };
}

async function fetchUsInflationFallback(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_CPI_URL, ["DATE"], ["VALUE"]);

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
    label: "Inflation (US, fallback)",
    value: yoy,
    change: yoy - previousYoy,
    unit: "%",
  };
}

async function fetchUsRateFallback(): Promise<MacroIndicator> {
  const points = await fetchCsvSeries(FRED_FEDFUNDS_URL, ["DATE"], ["VALUE"]);
  const { latest, change } = latestWithChange(points);

  return {
    label: "Fed Funds Rate (fallback)",
    value: latest,
    change,
    unit: "%",
  };
}

export async function getMacroData(): Promise<MacroData> {
  const sources = new Set<string>();

  const [inflationResult, rateResult] = await Promise.allSettled([
    fetchEcbInflation(),
    fetchEcbPolicyRate(),
  ]);

  let inflation: MacroIndicator;
  if (inflationResult.status === "fulfilled") {
    inflation = inflationResult.value;
    sources.add("ECB");
  } else {
    inflation = await fetchUsInflationFallback();
    sources.add("FRED");
  }

  let rate: MacroIndicator;
  if (rateResult.status === "fulfilled") {
    rate = rateResult.value;
    sources.add("ECB");
  } else {
    rate = await fetchUsRateFallback();
    sources.add("FRED");
  }

  return {
    indicators: [inflation, rate],
    updatedAt: new Date().toISOString(),
    sources: Array.from(sources),
  };
}
