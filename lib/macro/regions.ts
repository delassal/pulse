// Per-region inflation + policy-rate orchestration, picking the right source
// (FRED / BLS / CBR) per region and falling back to FRED proxies on failure.

import type { MacroIndicator, MacroRegionContext } from "@/types";
import {
  MACRO_HISTORY_POINTS,
  type RegionSeriesConfig,
} from "@/lib/macro/constants";
import { fetchCsvSeries, fetchUsDepositFacility } from "@/lib/macro/fred";
import { fetchUsInflation } from "@/lib/macro/bls";
import {
  fetchRussiaDepositFacilityProxy,
  fetchRussiaInflationProxy,
} from "@/lib/macro/cbr";
import {
  buildIndicator,
  mergeRegionHistory,
  toYoySeries,
} from "@/lib/macro/series";

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

export async function fetchRegionContext(config: RegionSeriesConfig): Promise<MacroRegionContext> {
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
