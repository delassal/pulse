import { NextRequest, NextResponse } from "next/server";
import { getWeatherData } from "@/lib/weather";
import type { ApiError } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get("city") ?? "Munich";
    const data = await getWeatherData(city);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected weather fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
