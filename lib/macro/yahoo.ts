// Yahoo Finance chart API, used for market series FRED no longer publishes (gold).

import type { MacroIndicator } from "@/types";
import { toNumber } from "@/lib/utils";
import {
  FETCH_START_DATE,
  MARKET_HISTORY_POINTS,
  YAHOO_GOLD_URL,
} from "@/lib/macro/constants";
import { buildIndicator, type SeriesPoint } from "@/lib/macro/series";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

async function fetchYahooDailyCloses(url: string): Promise<SeriesPoint[]> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Yahoo series (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => {
      const value = toNumber(closes[index]);

      if (value === null) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        value,
      };
    })
    .filter((point): point is SeriesPoint => point !== null && point.date >= FETCH_START_DATE);
}

export async function fetchGold(): Promise<MacroIndicator> {
  const points = await fetchYahooDailyCloses(YAHOO_GOLD_URL);
  return buildIndicator("gold", "Gold", "$", points, MARKET_HISTORY_POINTS);
}
