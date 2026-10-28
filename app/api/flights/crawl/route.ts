import { NextResponse, type NextRequest } from "next/server";
import { appendHistory, crawlFlights } from "@/lib/flights";
import { isFlightStoreConfigured, readHistory, saveCrawl } from "@/lib/flights-store";
import type { ApiError } from "@/types";

// 24+ upstream requests plus three blob writes; well under a minute in practice.
export const maxDuration = 300;

/**
 * Daily crawl, triggered by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected so
 * the public site cannot be used to burn the API quota.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return NextResponse.json<ApiError>({ error: "TRAVELPAYOUTS_TOKEN is not set" }, { status: 500 });
  }
  if (!isFlightStoreConfigured()) {
    return NextResponse.json<ApiError>(
      { error: "No Vercel Blob store connected (BLOB_READ_WRITE_TOKEN missing)" },
      { status: 500 },
    );
  }

  try {
    const { snapshot, errors } = await crawlFlights(token);
    const destinationCount = Object.keys(snapshot.destinations).length;

    // Never overwrite yesterday's good data with an empty crawl.
    if (destinationCount === 0) {
      return NextResponse.json(
        { error: "Crawl returned no fares", errors },
        { status: 502 },
      );
    }

    const history = appendHistory(await readHistory(), snapshot);
    await saveCrawl(snapshot, history);

    return NextResponse.json({
      ok: true,
      crawledAt: snapshot.crawledAt,
      destinations: destinationCount,
      requests: snapshot.requests,
      failedRequests: snapshot.failedRequests,
      historyDays: history.days.length,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected crawl error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
