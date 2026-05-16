import { NextResponse } from "next/server";
import { getGymUsageData } from "@/lib/gym";
import type { ApiError } from "@/types";

// Cache store: Map<key, { data, timestamp }>
const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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

export async function GET() {
  try {
    const cacheKey = "gym";
    
    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=120" },
      });
    }

    const data = await getGymUsageData();
    setCachedData(cacheKey, data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected gym usage fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
