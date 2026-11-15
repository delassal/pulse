"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "@/components/ui/Flag";
import { Card } from "@/components/ui/Card";
import { TravelIcon } from "@/components/ui/Icons";
import {
  ChangeDirection,
  ChangeSwatches,
  TRAVEL_CHANGES_QUERY,
  formatChangeDate,
} from "@/components/travel/TravelChanges";
import { TRAVEL_VIEWS } from "@/lib/travel-meta";

const LATEST_CHANGES = 3;

/**
 * Entry point to /travel with the latest level changes. Only the small change log is
 * loaded here; the advisories themselves (four sources) are fetched on the map page.
 */
export function TravelWidget() {
  const { data } = useQuery(TRAVEL_CHANGES_QUERY);
  const latest = data?.changes.slice(0, LATEST_CHANGES) ?? [];

  return (
    <Link
      href="/travel"
      className="block min-w-0 flex-1 rounded-2xl focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
    >
      <Card
        title="Travel advisories"
        subtitle={latest.length > 0 ? "Latest level changes" : "World map of official travel warnings"}
        icon={<TravelIcon className="h-5 w-5" />}
        className="flex h-full flex-col"
      >
        <div className="flex flex-1 flex-col justify-between gap-3">
          {latest.length > 0 ? (
            <ul className="space-y-1.5">
              {latest.map((change) => (
                <li
                  key={`${change.source}-${change.iso2}-${change.date}-${change.to}`}
                  title={`${change.fromLabel} → ${change.toLabel}`}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <ChangeSwatches change={change} />
                  <span className="min-w-0 flex-1 truncate">{change.name}</span>
                  <ChangeDirection change={change} label={false} />
                  <span className="theme-subtle flex-none text-xs tabular-nums">
                    {formatChangeDate(change.date, false)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <ul className="flex items-center gap-2" aria-label="Sources">
              {TRAVEL_VIEWS.map((view) => (
                <li key={view.id} title={view.label}>
                  <Flag code={view.id} className="h-3.5 w-[18px]" />
                </li>
              ))}
            </ul>
            <p className="text-xs font-medium text-[color:var(--accent)]">Open world map →</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
