import { NextResponse } from "next/server";
import { topLongHaulFares } from "@/lib/flight-utils";
import { isFlightStoreConfigured, readLatestSnapshot } from "@/lib/flights-store";
import type { ApiError, FlightSummary } from "@/types";

// The dashboard card only needs a few rows; the full snapshot (/api/flights) is megabytes.
const TOP_FARES = 3;

// The crawl runs once a day, so a long in-memory cache is plenty.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cached: { data: FlightSummary; timestamp: number } | null = null;

export async function GET() {
  try {
    if (!isFlightStoreConfigured()) {
      return NextResponse.json<FlightSummary>({
        top: [],
        crawledAt: null,
        notice: "Flight crawler is not set up yet: connect a Vercel Blob store to the project.",
      });
    }

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { "Cache-Control": "public, max-age=1800" },
      });
    }

    const snapshot = await readLatestSnapshot();
    if (!snapshot) {
      // Not cached anywhere, so the first crawl shows up right away.
      return NextResponse.json<FlightSummary>(
        { top: [], crawledAt: null, notice: "No crawl has run yet. The first one runs at 05:00 UTC." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const data: FlightSummary = {
      top: topLongHaulFares(snapshot, TOP_FARES),
      crawledAt: snapshot.crawledAt,
    };
    cached = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=1800" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected flight data error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
