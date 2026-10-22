import { NextResponse } from "next/server";
import { getTravelAdvisoryData } from "@/lib/travel";
import type { ApiError, TravelAdvisoryData } from "@/types";

// Advisories change a few times a day at most, so a long cache keeps upstream load low.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cached: { data: TravelAdvisoryData; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }

    const data = await getTravelAdvisoryData();

    // Only cache complete results so a temporarily failing source is retried soon.
    if (data.sources.every((source) => source.ok)) {
      cached = { data, timestamp: Date.now() };
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected travel advisory fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
