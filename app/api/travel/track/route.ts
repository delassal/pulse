import { NextResponse, type NextRequest } from "next/server";
import { getTravelAdvisoryData } from "@/lib/travel";
import { trackTravelChanges } from "@/lib/travel-changes";
import {
  isTravelStoreConfigured,
  readTravelHistory,
  saveTravelHistory,
} from "@/lib/travel-store";
import type { ApiError } from "@/types";

// ~230 GOV.UK requests plus three feeds; usually done in well under a minute.
export const maxDuration = 120;

/**
 * Daily advisory level tracking, triggered by Vercel Cron (see vercel.json): compares
 * today's levels with the ones on record and appends every difference to the change log.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTravelStoreConfigured()) {
    return NextResponse.json<ApiError>(
      { error: "No Vercel Blob store connected (BLOB_READ_WRITE_TOKEN missing)" },
      { status: 500 },
    );
  }

  try {
    const [data, history] = await Promise.all([getTravelAdvisoryData(), readTravelHistory()]);
    const { state, added, skipped } = trackTravelChanges(history, data);
    await saveTravelHistory(state);

    return NextResponse.json({
      ok: true,
      checkedAt: state.checkedAt,
      added,
      pending: Object.values(state.pending ?? {}).reduce(
        (count, countries) => count + Object.keys(countries).length,
        0,
      ),
      skippedSources: skipped,
      totalChanges: state.changes.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected tracking error";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
