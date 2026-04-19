import type { EtfData } from "@/types";
import { calcPctChange, csvToObjects, toNumber } from "@/lib/utils";

const STOOQ_HISTORY_URL = "https://stooq.pl/q/d/l/?s=vwce.de&i=d";

interface PriceRow {
  date: string;
  close: number;
}

export async function getEtfData(): Promise<EtfData> {
  const response = await fetch(STOOQ_HISTORY_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch ETF data");
  }

  const csvText = await response.text();
  const records = csvToObjects(csvText);

  const historyRows: PriceRow[] = records
    .map((record) => {
      const close = toNumber(record.Close);
      const date = record.Date;
      if (close === null || !date) {
        return null;
      }

      return { date, close };
    })
    .filter((row): row is PriceRow => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (historyRows.length < 2) {
    throw new Error("Insufficient ETF history for VWCE.DE");
  }

  const latest = historyRows[historyRows.length - 1];
  const previous = historyRows[historyRows.length - 2];
  const dailyChangePct = calcPctChange(latest.close, previous.close);

  const trend: EtfData["trend"] =
    dailyChangePct > 0 ? "up" : dailyChangePct < 0 ? "down" : "flat";

  const chartHistory = historyRows.slice(-20).map((point) => ({
    date: point.date,
    price: point.close,
  }));

  return {
    symbol: "VWCE.DE",
    name: "Vanguard FTSE All-World UCITS ETF",
    currency: "EUR",
    price: latest.close,
    dailyChangePct,
    trend,
    history: chartHistory,
    updatedAt: new Date().toISOString(),
  };
}
