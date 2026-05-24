import type { OnThisDayData } from "@/types";

interface WikimediaEvent {
  year: number;
  pages?: Array<{ extract?: string }>;
  text?: string;
}

interface WikimediaResponse {
  events?: WikimediaEvent[];
}

export async function getOnThisDayData(date?: Date): Promise<OnThisDayData> {
  const d = date ?? new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${month}/${day}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Pulse/1.0 (personal dashboard)" },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch on-this-day data");
  }

  const data = (await response.json()) as WikimediaResponse;
  const rawEvents = data.events ?? [];

  const events = rawEvents
    .slice(0, 6)
    .map((e) => ({
      year: e.year,
      text: e.pages?.[0]?.extract?.split(".")[0] ?? e.text ?? "",
    }))
    .filter((e) => e.text.length > 0)
    .slice(0, 3);

  return { events };
}
