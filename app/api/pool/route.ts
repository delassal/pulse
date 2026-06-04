import { NextResponse } from "next/server";
import { getPoolData } from "@/lib/pool";
import type { ApiError, PoolData } from "@/types";

const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
    const cached = getCachedData<PoolData>("pool");
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=120" },
      });
    }

    const data = await getPoolData();
    setCachedData("pool", data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected pool fetch error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
