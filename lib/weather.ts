import type { WeatherData } from "@/types";

const DEFAULT_CITY = "Munich";

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Heavy showers",
  95: "Thunderstorm",
};

interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
}

async function geocodeCity(city: string): Promise<GeocodingResult> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to geocode city");
  }

  const data = (await response.json()) as {
    results?: Array<GeocodingResult>;
  };

  const location = data.results?.[0];
  if (!location) {
    throw new Error(`No location found for ${city}`);
  }

  return location;
}

export async function getWeatherData(city = DEFAULT_CITY): Promise<WeatherData> {
  const location = await geocodeCity(city);
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}` +
    `&longitude=${location.longitude}&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;

  const weatherResponse = await fetch(weatherUrl, { cache: "no-store" });

  if (!weatherResponse.ok) {
    throw new Error("Unable to fetch weather data");
  }

  const weatherData = (await weatherResponse.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      time?: string;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };

  const temperature = weatherData.current?.temperature_2m;
  const weatherCode = weatherData.current?.weather_code;

  if (typeof temperature !== "number" || typeof weatherCode !== "number") {
    throw new Error("Incomplete weather data received");
  }

  const dailyMax = weatherData.daily?.temperature_2m_max?.[0];
  const dailyMin = weatherData.daily?.temperature_2m_min?.[0];

  return {
    city: location.name,
    temperature,
    unit: "C",
    condition: WEATHER_CODE_MAP[weatherCode] ?? "Unknown",
    weatherCode,
    updatedAt: weatherData.current?.time ?? new Date().toISOString(),
    forecast:
      typeof dailyMin === "number" && typeof dailyMax === "number"
        ? { min: Math.round(dailyMin), max: Math.round(dailyMax) }
        : undefined,
  };
}
