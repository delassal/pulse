import type { EtfData } from "@/types";
import { calcPctChange, toNumber } from "@/lib/utils";

const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/VWCE.DE?interval=1d&range=1mo&includePrePost=false&events=div%2Csplits";

export async function getEtfData(): Promise<EtfData> {
  const response = await fetch(YAHOO_CHART_URL, {
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
    throw new Error("Insufficient ETF history for VWCE.DE");
  }

  const latest = historyRows[historyRows.length - 1];
  const previous = historyRows[historyRows.length - 2];
  const dailyChangePct = calcPctChange(latest.close, previous.close);

  const trend: EtfData["trend"] =
    dailyChangePct > 0 ? "up" : dailyChangePct < 0 ? "down" : "flat";

  return {
    symbol: meta.symbol ?? "VWCE.DE",
    name: meta.longName ?? meta.shortName ?? "Vanguard FTSE All-World UCITS ETF",
    currency: meta.currency ?? "EUR",
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
