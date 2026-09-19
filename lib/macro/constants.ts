// Source URLs and shared constants for the macro data layer.

export const FRED_VIX_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS";
export const FRED_EURUSD_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSEU";
export const FRED_OIL_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO";
export const FRED_GOLD_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM";
export const FRED_PMI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NAPM";
export const FRED_FEDFUNDS_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";
export const BLS_US_CPI_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

export const FRED_INFLATION_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CP0000EZ19M086NEST";
export const FRED_INFLATION_UK_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GBRCPIALLMINMEI";
export const FRED_INFLATION_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=USACPIALLMINMEI";
export const FRED_INFLATION_RU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPALTT01RUM657N";
export const FRED_INFLATION_CN_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CHNCPIALLMINMEI";

export const FRED_DEPOSIT_FACILITY_EU_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=ECBDFR";
export const FRED_DEPOSIT_FACILITY_UK_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01GBM156N";
export const FRED_DEPOSIT_FACILITY_US_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB";
export const FRED_DEPOSIT_FACILITY_RU_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IRSTCI01RUM156N";
export const FRED_DEPOSIT_FACILITY_CN_PROXY_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IR3TIB01CNM156N";
export const CBR_KEY_RATE_URL =
  "https://www.cbr.ru/hd_base/KeyRate/?UniDbQuery.Posted=True";
export const CBR_INFLATION_URL =
  "https://www.cbr.ru/hd_base/infl/?UniDbQuery.Posted=True";

export const FETCH_START_DATE = "2019-01-01";
export const DISPLAY_START_DATE = "2020-01-01";
export const MARKET_HISTORY_POINTS = 40;
export const MACRO_HISTORY_POINTS = 3000;

export type RegionId = "eu" | "uk" | "us" | "russia" | "china";

export interface RegionSeriesConfig {
  id: RegionId;
  label: string;
  inflationUrl: string;
  depositFacilityUrl: string;
}

export const REGION_SERIES_CONFIGS: RegionSeriesConfig[] = [
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
