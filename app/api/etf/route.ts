import { NextResponse } from "next/server";
import { ETF_CONFIGS, getEtfData } from "@/lib/etf";
import type { ApiError } from "@/types";

// Cache store: Map<key, { data, timestamp }>
const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const isin = url.searchParams.get("isin");

    if (isin) {
      const cacheKey = `etf:${isin}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: { "Cache-Control": "public, max-age=300" },
        });
      }

      const data = await getEtfData(isin);
      setCachedData(cacheKey, data);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    const cacheKey = "etf:all";
    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    const data = await Promise.all(ETF_CONFIGS.map((config) => getEtfData(config.isin)));
    setCachedData(cacheKey, data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ETF fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
