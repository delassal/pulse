"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { GlobeIcon } from "@/components/ui/Icons";
import { SEVERITY_COLOR } from "@/lib/travel-meta";
import type { ApiError, TravelAdvisoryData, TravelSourceId } from "@/types";

const ROWS: Array<{ id: TravelSourceId; label: string; phrase: string }> = [
  { id: "de", label: "Germany", phrase: "travel warnings" },
  { id: "us", label: "United States", phrase: "do not travel" },
  { id: "ca", label: "Canada", phrase: "avoid all travel" },
];

async function fetchTravel(): Promise<TravelAdvisoryData> {
  const response = await fetch("/api/travel");
  const body = (await response.json()) as TravelAdvisoryData | ApiError;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error : "Unable to load travel advisories");
  }
  return body;
}

export function TravelWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["travel"],
    queryFn: fetchTravel,
    staleTime: 60 * 60 * 1000,
    refetchInterval: false,
  });

  return (
    <Link href="/travel" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]">
      <Card title="Travel advisories" subtitle="Highest level by source" icon={<GlobeIcon className="h-5 w-5" />}>
        {isLoading ? (
          <p className="theme-subtle text-sm">Loading…</p>
        ) : error || !data ? (
          <p className="theme-subtle text-sm">Unavailable right now.</p>
        ) : (
          <ul className="space-y-2">
            {ROWS.map((row) => {
              const source = data.sources.find((item) => item.id === row.id);
              const count = data.countries.filter(
                (country) => country.advisories[row.id]?.severity === 4,
              ).length;
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="theme-muted">{row.label}</span>
                  {source?.ok ? (
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-[3px]"
                        style={{ background: SEVERITY_COLOR[4] }}
                      />
                      <span className="font-semibold tabular-nums">{count}</span>
                      <span className="theme-subtle text-xs">{row.phrase}</span>
                    </span>
                  ) : (
                    <span className="theme-subtle text-xs">unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs font-medium text-[color:var(--accent)]">Open world map →</p>
      </Card>
    </Link>
  );
}
