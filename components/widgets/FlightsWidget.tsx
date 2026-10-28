"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PlaneIcon } from "@/components/ui/Icons";
import { cheapestFares } from "@/lib/flight-utils";
import type { FlightData } from "@/types";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Teaser for /flights: the three cheapest long-haul round trips from Munich. */
export function FlightsWidget() {
  const { data } = useQuery({
    queryKey: ["flights"],
    queryFn: async () => (await (await fetch("/api/flights")).json()) as FlightData,
    refetchInterval: false,
    staleTime: 15 * 60_000,
  });

  const top = Object.values(data?.snapshot?.destinations ?? {})
    .filter((destination) => destination.region !== "Europe")
    .map((destination) => ({ destination, best: cheapestFares(destination).roundTrip }))
    .filter((row) => row.best !== null)
    .sort((a, b) => a.best!.fare.price - b.best!.fare.price)
    .slice(0, 3);

  return (
    <Link
      href="/flights"
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
    >
      <Card
        title="Flights from Munich"
        subtitle="Long-haul round trips, next 12 months"
        icon={<PlaneIcon className="h-5 w-5" />}
      >
        {top.length > 0 ? (
          <ul className="space-y-1.5">
            {top.map(({ destination, best }) => (
              <li key={destination.code} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{destination.name}</span>
                <span className="font-semibold">{euro.format(best!.fare.price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="theme-subtle text-sm">{data?.notice ?? "Loading fares…"}</p>
        )}
        <p className="mt-3 text-right text-xs font-medium text-[color:var(--accent)]">All destinations →</p>
      </Card>
    </Link>
  );
}
