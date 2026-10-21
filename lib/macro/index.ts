// Public entry point for the macro data layer: assembles market indicators,
// regional inflation/policy-rate context, and the PMI into a single payload.
// Partial upstream failures are tolerated and signalled via `sources: [..., "partial"]`.

import type { MacroData } from "@/types";
import { REGION_SERIES_CONFIGS } from "@/lib/macro/constants";
import {
  fetchEurUsd,
  fetchGold,
  fetchOil,
  fetchPmi,
  fetchVix,
} from "@/lib/macro/fred";
import { fetchRegionContext } from "@/lib/macro/regions";

function fulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

function hasAnyFailure<T>(results: PromiseSettledResult<T>[]) {
  return results.some((result) => result.status === "rejected");
}

function withFirstFailureReason<T>(message: string, results: PromiseSettledResult<T>[]) {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const reason = rejected?.reason instanceof Error ? rejected.reason.message : undefined;
  return reason ? `${message}: ${reason}` : message;
}

export async function getMacroData(): Promise<MacroData> {
  const [marketsTodayResults, regionResults, macroContextResults] = await Promise.all([
    Promise.allSettled([fetchVix(), fetchEurUsd(), fetchOil(), fetchGold()]),
    Promise.allSettled(REGION_SERIES_CONFIGS.map((config) => fetchRegionContext(config))),
    Promise.allSettled([fetchPmi()]),
  ]);

  const marketsToday = fulfilledValues(marketsTodayResults);
  if (marketsToday.length === 0) {
    throw new Error(
      withFirstFailureReason("Failed to fetch market indicators", marketsTodayResults),
    );
  }

  const regions = fulfilledValues(regionResults);
  if (regions.length === 0) {
    throw new Error(
      withFirstFailureReason("Failed to fetch regional macro context", regionResults),
    );
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
