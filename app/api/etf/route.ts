import { NextResponse } from "next/server";
import { ETF_CONFIGS, getEtfData } from "@/lib/etf";
import type { ApiError } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const isin = url.searchParams.get("isin");

    if (isin) {
      const data = await getEtfData(isin);
      return NextResponse.json(data);
    }

    const data = await Promise.all(ETF_CONFIGS.map((config) => getEtfData(config.isin)));
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ETF fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
