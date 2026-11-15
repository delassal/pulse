import { NextResponse } from "next/server";
import { readTravelHistory } from "@/lib/travel-store";
import type { ApiError, TravelChangeData } from "@/types";

// The change log only grows with the daily tracking run.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cached: { data: TravelChangeData; timestamp: number } | null = null;

export async function GET() {
  try {
    if (!cached || Date.now() - cached.timestamp >= CACHE_TTL_MS) {
      const { changes, trackingSince, checkedAt } = await readTravelHistory();
      cached = { data: { changes, trackingSince, checkedAt }, timestamp: Date.now() };
    }

    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected travel history error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
