import type { EtfData } from "@/types";
import { calcPctChange, toNumber } from "@/lib/utils";

export interface EtfConfig {
  isin: string;
  symbol: string;
  name: string;
  currency: string;
}

export const ETF_CONFIGS: EtfConfig[] = [
  {
    isin: "IE0031442068",
    symbol: "IDUS.L",
    name: "iShares Core S&P 500 UCITS ETF USD (Dist)",
    currency: "USD",
  },
  {
    isin: "DE0002635307",
    symbol: "EXSA.DE",
    name: "iShares STOXX Europe 600 UCITS ETF (DE) EUR (Dist)",
    currency: "EUR",
  },
  {
    isin: "IE00BD45KH83",
    symbol: "EIMU.L",
    name: "iShares Core MSCI EM IMI UCITS ETF USD (Dist)",
    currency: "USD",
  },
];

function getYahooChartUrl(symbol: string) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo&includePrePost=false&events=div%2Csplits`;
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
  const response = await fetch(getYahooChartUrl(config.symbol), {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch ETF data");
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          currency?: string;
          symbol?: string;
          longName?: string;
          shortName?: string;
          regularMarketPrice?: number;
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
  };

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

  const meta = result?.meta;

  if (historyRows.length < 2 || !meta) {
    throw new Error(`Insufficient ETF history for ${config.symbol}`);
  }

  const latest = historyRows[historyRows.length - 1];
  const previous = historyRows[historyRows.length - 2];
  const dailyChangePct = calcPctChange(latest.close, previous.close);

  const trend: EtfData["trend"] =
    dailyChangePct > 0 ? "up" : dailyChangePct < 0 ? "down" : "flat";

  return {
    symbol: meta.symbol ?? config.symbol,
    name: meta.longName ?? meta.shortName ?? config.name,
    currency: meta.currency ?? config.currency,
    price: meta.regularMarketPrice ?? latest.close,
    dailyChangePct,
    trend,
    history: historyRows.slice(-20).map((point) => ({
      date: point.date,
      price: point.close,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function resolveEtfFromIdentifier(identifier: string): EtfConfig {
  return getEtfConfig(identifier);
}
