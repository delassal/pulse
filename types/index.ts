export type TrendDirection = "up" | "down" | "flat";

export interface EtfPoint {
  date: string;
  price: number;
}

export interface EtfData {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  dailyChangePct: number;
  ytdChangePct: number;
  trend: TrendDirection;
  history: EtfPoint[];
  fullHistory: EtfPoint[];
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
  inflation: MacroIndicator;
  policyRate: MacroIndicator;
  history: MacroRegionContextPoint[];
}

export interface MacroData {
  marketsToday: MacroIndicator[];
  macroEnvironment: MacroIndicator[];
  regions: MacroRegionContext[];
  indicators: MacroIndicator[];
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

export type TravelSourceId = "de" | "us" | "ca";

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
