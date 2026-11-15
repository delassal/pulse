export type TrendDirection = "up" | "down" | "flat";

export interface EtfPoint {
  date: string;
  price: number;
}

export interface EtfClose {
  date: string;
  price: number;
  /** Change versus the previous trading day's close. */
  changePct: number;
}

export interface EtfYearPerformance {
  year: number;
  /** Price return from the previous year's last close to this year's last close. */
  changePct: number;
}

export interface EtfData {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  dailyChangePct: number;
  ytdChangePct: number;
  trend: TrendDirection;
  /** Daily closes of the current year, led by the previous year's last close (the YTD base). */
  history: EtfPoint[];
  /** Monthly closes since inception. */
  fullHistory: EtfPoint[];
  /** Most recent daily closes, newest first. During trading hours the first row is today's live price. */
  recentCloses: EtfClose[];
  /** The last complete calendar years, oldest first. */
  yearlyPerformance: EtfYearPerformance[];
  asOf: string;
  updatedAt: string;
}

export interface MacroIndicator {
  id: string;
  label: string;
  value: number;
  change?: number;
  unit: string;
  history?: { date: string; value: number }[];
}

export interface MacroRegionContextPoint {
  date: string;
  inflation: number;
  policyRate: number;
}

export interface MacroRegionContext {
  id: "eu" | "uk" | "us" | "russia" | "china";
  label: string;
  /** `history` holds only the latest point (its date drives the freshness note). */
  inflation: MacroIndicator;
  /** `history` holds only the latest point (its date drives the freshness note). */
  policyRate: MacroIndicator;
  history: MacroRegionContextPoint[];
}

export interface MacroData {
  marketsToday: MacroIndicator[];
  regions: MacroRegionContext[];
  updatedAt: string;
  sources: string[];
}

export interface WeatherData {
  city: string;
  temperature: number;
  unit: string;
  condition: string;
  weatherCode: number;
  updatedAt: string;
  forecast?: { min: number; max: number };
}

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  pubDate: string;
}

export interface NewsData {
  items: NewsItem[];
  source: string;
}

export type GymUsageLevel = "LOW" | "MEDIUM" | "HIGH";

export interface GymUsagePoint {
  startTime: string;
  endTime: string;
  percentage: number;
  level: GymUsageLevel;
  isCurrent: boolean;
  /** Slot lies later today: the percentage is Fitness First's forecast, not a measurement. */
  isFuture: boolean;
}

export interface GymUsageData {
  clubId: string;
  currentPercentage: number | null;
  level: GymUsageLevel | null;
  isOpen: boolean;
  day: string;
  startTime: string;
  endTime: string;
  timeline: GymUsagePoint[];
  updatedAt: string;
}

export interface ApiError {
  error: string;
}

export type OccupancyLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PoolArea {
  id: string;
  name: string;
  current: number;
  max: number;
  percentage: number;
  level: OccupancyLevel;
}

export interface PoolData {
  pools: PoolArea[];
  updatedAt: string;
}

export type TravelSourceId = "de" | "us" | "ca" | "uk";

/** Severity on a shared 1-4 scale used for map colouring (4 = most severe). */
export type TravelSeverity = 1 | 2 | 3 | 4;

export interface TravelAdvisory {
  severity: TravelSeverity;
  /** Label as published by the source (e.g. "Level 3: Reconsider Travel"). */
  label: string;
  /** True when the advisory only covers parts of the country. */
  regional: boolean;
  url?: string;
  updatedAt?: string;
}

export interface TravelCountry {
  iso2: string;
  /** ISO 3166-1 numeric code, used to join with the world map. */
  numeric: string | null;
  name: string;
  advisories: Partial<Record<TravelSourceId, TravelAdvisory>>;
}

export interface TravelSourceStatus {
  id: TravelSourceId;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  /** Source entries that could not be matched to an ISO country code. */
  unmatched?: string[];
}

export interface TravelAdvisoryData {
  countries: TravelCountry[];
  sources: TravelSourceStatus[];
  updatedAt: string;
}

/** One source moving one country to a different level on the shared 1-4 scale. */
export interface TravelChange {
  /** Day the new level was published (or first seen in a snapshot), YYYY-MM-DD. */
  date: string;
  iso2: string;
  name: string;
  source: TravelSourceId;
  from: TravelSeverity;
  to: TravelSeverity;
  fromLabel: string;
  toLabel: string;
}

export interface TravelChangeData {
  /** Newest first. */
  changes: TravelChange[];
  /** First day each source's levels were recorded, YYYY-MM-DD. */
  trackingSince: Partial<Record<TravelSourceId, string>>;
  /** Last time the levels were compared against the sources. */
  checkedAt: string | null;
}

export type FlightRegion =
  | "Europe"
  | "Asia"
  | "Africa"
  | "Middle East"
  | "Americas"
  | "Oceania";

/** One cached fare as reported by the Travelpayouts (Aviasales) Data API. */
export interface FlightFare {
  price: number;
  departureAt: string;
  returnAt: string | null;
  airline: string;
  transfers: number;
  returnTransfers: number | null;
  /** Total travel time in minutes (outbound + return for round trips). */
  duration: number | null;
  /** Absolute Aviasales search URL for this fare. */
  link: string;
}

/** Length of stay of a round trip: up to 4 nights, 5-9, 10-16, 17 or more. */
export type FlightStay = "short" | "week" | "twoWeeks" | "long";

export interface FlightMonthFares {
  oneWay?: FlightFare;
  /** Cheapest round trip of the month, whatever the length of stay. */
  roundTrip?: FlightFare;
  /** Cheapest round trip per length of stay, from the per-route pass of the crawl. */
  stays?: Partial<Record<FlightStay, FlightFare>>;
  /** Day (YYYY-MM-DD) the `stays` fares were crawled; older than the snapshot when carried over. */
  staysAt?: string;
}

export interface FlightDestination {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  region: FlightRegion;
  /** Keyed by departure month, YYYY-MM. */
  months: Record<string, FlightMonthFares>;
}

export interface FlightSnapshot {
  origin: string;
  currency: "EUR";
  crawledAt: string;
  months: string[];
  requests: number;
  failedRequests: number;
  /** Per-route pass for the lengths of stay: route-months refreshed today out of all of them. */
  stayRoutes?: { refreshed: number; total: number };
  destinations: Record<string, FlightDestination>;
}

/** Cheapest fare per destination over the whole 12-month window, one row per crawl day. */
export interface FlightHistory {
  days: string[];
  /** [oneWay, roundTrip] per day, aligned with `days`; null when no fare was cached. */
  series: Record<string, Array<[number | null, number | null]>>;
}

export interface FlightSummaryFare {
  code: string;
  name: string;
  price: number;
  /** Departure month, YYYY-MM. */
  month: string;
  nights: number | null;
}

/** Small extract of the snapshot for the dashboard card. */
export interface FlightSummary {
  /** Cheapest long-haul round trips of up to 16 nights, one per destination. */
  top: FlightSummaryFare[];
  crawledAt: string | null;
  notice?: string;
}

export interface FlightData {
  snapshot: FlightSnapshot | null;
  history: FlightHistory | null;
  /** Set when the crawler has not produced data yet (e.g. missing configuration). */
  notice?: string;
}
