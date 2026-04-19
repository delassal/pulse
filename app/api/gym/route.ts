import { NextResponse } from "next/server";
import { getGymUsageData } from "@/lib/gym";
import type { ApiError } from "@/types";

export async function GET() {
  try {
    const data = await getGymUsageData();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected gym usage fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
