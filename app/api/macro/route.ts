import { NextResponse } from "next/server";
import { getMacroData } from "@/lib/macro";
import type { ApiError } from "@/types";

export async function GET() {
  try {
    const data = await getMacroData();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected macro fetch error";

    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
