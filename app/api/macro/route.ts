import { NextResponse } from "next/server";
import { getMacroData } from "@/lib/macro";
import type { ApiError } from "@/types";

// Cache store: Map<key, { data, timestamp }>
const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
    const cacheKey = "macro";
    
    const cached = getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=900" },
      });
    }

    const data = await getMacroData();
    setCachedData(cacheKey, data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=900" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected macro fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
