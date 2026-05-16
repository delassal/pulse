import { NextRequest, NextResponse } from "next/server";
import { getWeatherData } from "@/lib/weather";
import type { ApiError } from "@/types";

// Cache store: Map<key, { data, timestamp }>
const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedData<T>(key: string): T | null {
  const cached = cacheStore.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    cacheStore.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCachedData(key: string, data: unknown): void {
  cacheStore.set(key, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get("city") ?? "Munich";
    const cacheKey = `weather:${city}`;
    
    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=600" },
      });
    }

    const data = await getWeatherData(city);
    setCachedData(cacheKey, data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected weather fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
