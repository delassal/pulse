import { NextResponse } from "next/server";
import { getOnThisDayData } from "@/lib/onthisday";
import type { ApiError } from "@/types";

const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — events don't change during the day

function getCachedData<T>(key: string): T | null {
  const cached = cacheStore.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
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
    const now = new Date();
    const cacheKey = `onthisday:${now.getMonth() + 1}-${now.getDate()}`;

    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=86400" },
      });
    }

    const data = await getOnThisDayData(now);
    setCachedData(cacheKey, data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected on-this-day fetch error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
