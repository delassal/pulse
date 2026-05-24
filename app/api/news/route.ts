import { NextResponse } from "next/server";
import { getNewsData } from "@/lib/news";
import type { ApiError } from "@/types";

const cacheStore = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
    const cached = getCachedData("news");
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=900" },
      });
    }

    const data = await getNewsData();
    setCachedData("news", data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=900" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected news fetch error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
