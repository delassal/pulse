import { NextResponse } from "next/server";
import { getEtfData } from "@/lib/etf";
import type { ApiError } from "@/types";

export async function GET() {
  try {
    const data = await getEtfData();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ETF fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
