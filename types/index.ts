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
  trend: TrendDirection;
  history: EtfPoint[];
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

export interface ApiError {
  error: string;
}
