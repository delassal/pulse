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

function getYahooChartUrl(symbol: string, range: "1y" | "max") {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}&includePrePost=false&events=div%2Csplits`;
}

function startOfYearIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function formatAsOf(timestamp?: number): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  return new Date(timestamp * 1000).toISOString();
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

  const [fullResponse, ytdResponse] = await Promise.all([
    fetch(getYahooChartUrl(config.symbol, "max"), { cache: "no-store", headers }),
    fetch(getYahooChartUrl(config.symbol, "1y"), { cache: "no-store", headers }),
  ]);

  if (!fullResponse.ok || !ytdResponse.ok) {
    throw new Error("Unable to fetch ETF data");
  }

  const [fullPayload, ytdPayload] = (await Promise.all([
    fullResponse.json(),
    ytdResponse.json(),
  ])) as Array<{
    chart?: {
      result?: Array<{
        meta?: {
          currency?: string;
          symbol?: string;
          longName?: string;
          shortName?: string;
          regularMarketPrice?: number;
          regularMarketTime?: number;
          chartPreviousClose?: number;
        };
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }>;
    };
  }>;

  const toHistoryRows = (payload: typeof fullPayload) => {
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];

    const historyRows = timestamps
      .map((timestamp, index) => {
        const close = toNumber(closes[index]);
        if (close === null) {
          return null;
        }

        return {
          date: new Date(timestamp * 1000).toISOString().slice(0, 10),
          close,
        };
      })
      .filter((point): point is { date: string; close: number } => point !== null);

    return { historyRows, meta: result?.meta };
  };

  const { historyRows: fullHistoryRows, meta: fullMeta } = toHistoryRows(fullPayload);
  const { historyRows: ytdHistoryRows, meta: ytdMeta } = toHistoryRows(ytdPayload);
  const meta = fullMeta ?? ytdMeta;

  if (fullHistoryRows.length < 2 || !meta) {
    throw new Error(`Insufficient ETF history for ${config.symbol}`);
  }

  const asOf = formatAsOf(meta.regularMarketTime);
  const yearStart = startOfYearIso();
  const ytdHistory = ytdHistoryRows.filter((point) => point.date >= yearStart);
  const chartHistory = ytdHistory.length >= 2 ? ytdHistory : fullHistoryRows;
  const firstYtdPoint = chartHistory[0];
  const latest = fullHistoryRows[fullHistoryRows.length - 1];
  const previous = fullHistoryRows[fullHistoryRows.length - 2];
  const dailyChangePct = calcPctChange(latest.close, previous.close);
  const ytdChangePct = calcPctChange(latest.close, firstYtdPoint.close);

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
    history: chartHistory.map((point) => ({
      date: point.date,
      price: point.close,
    })),
    fullHistory: fullHistoryRows.map((point) => ({
      date: point.date,
      price: point.close,
    })),
    asOf,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveEtfFromIdentifier(identifier: string): EtfConfig {
  return getEtfConfig(identifier);
}
