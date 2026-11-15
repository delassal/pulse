import type { EtfData } from "@/types";
import { calcPctChange, toNumber } from "@/lib/utils";

export interface EtfConfig {
  isin: string;
  symbol: string;
  name: string;
  currency: string;
  displayName: string;
  region: "us" | "europe" | "asia";
}

export const ETF_CONFIGS: EtfConfig[] = [
  {
    isin: "IE0031442068",
    symbol: "IDUS.L",
    name: "iShares Core S&P 500 UCITS ETF USD (Dist)",
    currency: "USD",
    displayName: "S&P 500 (ETF)",
    region: "us",
  },
  {
    isin: "DE0002635307",
    symbol: "EXSA.DE",
    name: "iShares STOXX Europe 600 UCITS ETF (DE) EUR (Dist)",
    currency: "EUR",
    displayName: "STOXX Europe 600 (ETF)",
    region: "europe",
  },
  {
    isin: "IE00BD45KH83",
    symbol: "EIMU.L",
    name: "iShares Core MSCI EM IMI UCITS ETF USD (Dist)",
    currency: "USD",
    displayName: "Emerging Markets (ETF)",
    region: "asia",
  },
];

type YahooRange = "10y" | "max";

// Yahoo coarsens `range=max` to monthly bars no matter which interval is requested,
// so daily figures (day change, recent closes, calendar years) come from the 10y range.
function getYahooChartUrl(symbol: string, range: YahooRange) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}&includePrePost=false&events=div%2Csplits`;
}

const RECENT_CLOSES = 6;
const CALENDAR_YEARS = 5;

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        exchangeTimezoneName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface CloseRow {
  date: string;
  close: number;
}

/** Calendar date (YYYY-MM-DD) of a timestamp at the exchange, not in UTC. */
function exchangeDateFormatter(timeZone?: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return (timestamp: number) => formatter.format(new Date(timestamp * 1000));
  } catch {
    return (timestamp: number) => new Date(timestamp * 1000).toISOString().slice(0, 10);
  }
}

function toCloseRows(payload: YahooChartPayload) {
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const toDate = exchangeDateFormatter(meta?.exchangeTimezoneName);

  const rows: CloseRow[] = [];
  timestamps.forEach((timestamp, index) => {
    const close = toNumber(closes[index]);
    if (close !== null) rows.push({ date: toDate(timestamp), close });
  });

  // The newest bar often arrives without a close; the quote in `meta` is the price for it.
  if (meta?.regularMarketPrice && meta.regularMarketTime) {
    const marketDate = toDate(meta.regularMarketTime);
    const last = rows[rows.length - 1];
    if (!last || marketDate > last.date) {
      rows.push({ date: marketDate, close: meta.regularMarketPrice });
    } else if (marketDate === last.date) {
      last.close = meta.regularMarketPrice;
    }
  }

  return { rows, meta };
}

/** Last close of each calendar year, keyed by year. */
function yearEndCloses(rows: CloseRow[]) {
  const byYear = new Map<number, number>();
  for (const row of rows) byYear.set(Number(row.date.slice(0, 4)), row.close);
  return byYear;
}

function getEtfConfig(identifier: string): EtfConfig {
  const normalized = identifier.trim().toUpperCase();
  const config = ETF_CONFIGS.find(
    (entry) => entry.isin === normalized || entry.symbol.toUpperCase() === normalized,
  );

  if (!config) {
    throw new Error(`Unsupported ETF: ${identifier}`);
  }

  return config;
}

export async function getEtfData(identifier: string): Promise<EtfData> {
  const config = getEtfConfig(identifier);
  const headers = {
    "user-agent": "Mozilla/5.0",
    accept: "application/json",
  };

  const [monthlyResponse, dailyResponse] = await Promise.all([
    fetch(getYahooChartUrl(config.symbol, "max"), { cache: "no-store", headers }),
    fetch(getYahooChartUrl(config.symbol, "10y"), { cache: "no-store", headers }),
  ]);

  if (!monthlyResponse.ok || !dailyResponse.ok) {
    throw new Error("Unable to fetch ETF data");
  }

  const [monthlyPayload, dailyPayload] = (await Promise.all([
    monthlyResponse.json(),
    dailyResponse.json(),
  ])) as YahooChartPayload[];

  const { rows: monthlyRows, meta: monthlyMeta } = toCloseRows(monthlyPayload);
  const { rows: dailyRows, meta: dailyMeta } = toCloseRows(dailyPayload);
  const meta = dailyMeta ?? monthlyMeta;

  if (dailyRows.length < 2 || monthlyRows.length < 2 || !meta) {
    throw new Error(`Insufficient ETF history for ${config.symbol}`);
  }

  const latest = dailyRows[dailyRows.length - 1];
  const previous = dailyRows[dailyRows.length - 2];
  const dailyChangePct = calcPctChange(latest.close, previous.close);

  // YTD is measured from the last close of the previous year, so that row leads the chart.
  const currentYear = Number(latest.date.slice(0, 4));
  const firstOfYear = dailyRows.findIndex((row) => Number(row.date.slice(0, 4)) === currentYear);
  const ytdRows = dailyRows.slice(Math.max(0, firstOfYear - 1));
  const ytdChangePct = calcPctChange(latest.close, ytdRows[0].close);

  const recentCloses = dailyRows
    .slice(-(RECENT_CLOSES + 1))
    .map((row, index, rows) =>
      index === 0
        ? null
        : { date: row.date, price: row.close, changePct: calcPctChange(row.close, rows[index - 1].close) },
    )
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .reverse();

  const yearEnds = yearEndCloses(dailyRows);
  const yearlyPerformance: EtfData["yearlyPerformance"] = [];
  for (let year = currentYear - CALENDAR_YEARS; year < currentYear; year += 1) {
    const end = yearEnds.get(year);
    const start = yearEnds.get(year - 1);
    if (end !== undefined && start !== undefined) {
      yearlyPerformance.push({ year, changePct: calcPctChange(end, start) });
    }
  }

  const trend: EtfData["trend"] =
    dailyChangePct > 0 ? "up" : dailyChangePct < 0 ? "down" : "flat";

  return {
    symbol: meta.symbol ?? config.symbol,
    name: meta.longName ?? meta.shortName ?? config.name,
    currency: meta.currency ?? config.currency,
    price: meta.regularMarketPrice ?? latest.close,
    dailyChangePct,
    ytdChangePct,
    trend,
    history: ytdRows.map((row) => ({ date: row.date, price: row.close })),
    fullHistory: monthlyRows.map((row) => ({ date: row.date, price: row.close })),
    recentCloses,
    yearlyPerformance,
    asOf: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
