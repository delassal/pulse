import { NextResponse } from "next/server";
import { isFlightStoreConfigured, readHistory, readLatestSnapshot } from "@/lib/flights-store";
import type { ApiError, FlightData } from "@/types";

// The crawl runs once a day, so a long in-memory cache is plenty.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cached: { data: FlightData; timestamp: number } | null = null;

export async function GET() {
  try {
    if (!isFlightStoreConfigured()) {
      return NextResponse.json<FlightData>({
        snapshot: null,
        history: null,
        notice: "Flight crawler is not set up yet: connect a Vercel Blob store to the project.",
      });
    }

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "public, max-age=900" },
      });
    }

    const [snapshot, history] = await Promise.all([readLatestSnapshot(), readHistory()]);
    const data: FlightData = snapshot
      ? { snapshot, history }
      : { snapshot: null, history: null, notice: "No crawl has run yet. The first one runs at 05:00 UTC." };

    if (snapshot) cached = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=900" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected flight data error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
