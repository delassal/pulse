"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PlaneIcon } from "@/components/ui/Icons";
import type { ApiError, FlightSummary } from "@/types";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function monthName(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Teaser for /flights: the three cheapest long-haul round trips of a holiday's length. */
export function FlightsWidget() {
  const { data, isError } = useQuery<FlightSummary, Error>({
    queryKey: ["flights", "summary"],
    queryFn: async () => {
      const response = await fetch("/api/flights/summary");
      const payload = (await response.json()) as FlightSummary | ApiError;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Flight request failed");
      }
      return payload;
    },
    refetchInterval: false,
    staleTime: 15 * 60_000,
  });

  const top = data?.top ?? [];

  return (
    <Link
      href="/flights"
      className="block min-w-0 flex-1 rounded-2xl focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
    >
      <Card
        title="Flights from Munich"
        subtitle="Long-haul round trips, up to 16 nights"
        icon={<PlaneIcon className="h-5 w-5" />}
        className="flex h-full flex-col"
      >
        <div className="flex flex-1 flex-col justify-between gap-3">
          {top.length > 0 ? (
            <ul className="space-y-1.5">
              {top.map((fare) => (
                <li key={fare.code} className="flex items-baseline gap-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{fare.name}</span>
                  <span className="theme-subtle flex-none text-xs">
                    {monthName(fare.month)}
                    {fare.nights ? ` · ${fare.nights} ${fare.nights === 1 ? "night" : "nights"}` : ""}
                  </span>
                  <span className="flex-none font-semibold tabular-nums">{euro.format(fare.price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${isError ? "text-[color:var(--danger)]" : "theme-subtle"}`}>
              {isError ? "Flight prices unavailable" : (data?.notice ?? "Loading fares…")}
            </p>
          )}
          <p className="text-right text-xs font-medium text-[color:var(--accent)]">All destinations →</p>
        </div>
      </Card>
    </Link>
  );
}
