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
  asOf: string;
  updatedAt: string;
}

export interface MacroIndicator {
  label: string;
  value: number;
  change?: number;
  unit: string;
}

export interface MacroData {
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
