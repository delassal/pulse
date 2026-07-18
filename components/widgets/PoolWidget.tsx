"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PoolIcon } from "@/components/ui/Icons";
import type { ApiError, OccupancyLevel, PoolData } from "@/types";

const LEVEL_COLOR: Record<OccupancyLevel, string> = {
  LOW: "var(--success)",
  MEDIUM: "var(--warning)",
  HIGH: "var(--danger)",
};

const LEVEL_LABEL: Record<OccupancyLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function PoolWidget() {
  const { data, isLoading, isError, error } = useQuery<PoolData, Error>({
    queryKey: ["pool"],
    queryFn: async () => {
      const res = await fetch("/api/pool");
      const payload = (await res.json()) as PoolData | ApiError;
      if (!res.ok) {
        throw new Error("error" in payload ? payload.error : "Pool request failed");
      }
      return payload as PoolData;
    },
  });

  if (isLoading) {
    return (
      <Card title="M-Bäder" subtitle="Occupancy" icon={<PoolIcon className="h-5 w-5" />}>
        <p className="theme-muted text-sm">Loading occupancy...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="M-Bäder" subtitle="Occupancy" icon={<PoolIcon className="h-5 w-5" />}>
        <p className="text-sm text-[color:var(--danger)]">
          {error?.message ?? "Occupancy unavailable"}
        </p>
      </Card>
    );
  }

  const updatedAt = new Date(data.updatedAt).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card title="M-Bäder" subtitle="Aktuelle Auslastung" icon={<PoolIcon className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.pools.map((pool) => {
          const pct = Math.round(pool.percentage);
          const color = LEVEL_COLOR[pool.level];
          return (
            <div key={pool.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="theme-text text-sm font-medium">{pool.name}</span>
                <span className="text-sm font-semibold" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <div className="theme-subtle h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--subtle)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="theme-muted text-xs" style={{ color }}>
                  {LEVEL_LABEL[pool.level]}
                </span>
                <span className="theme-muted text-xs">
                  {pool.current.toLocaleString("de-DE")} / {pool.max.toLocaleString("de-DE")}
                </span>
              </div>
            </div>
          );
        })}
        {data.pools.length === 0 && (
          <p className="theme-muted text-sm">Keine Daten verfügbar</p>
        )}
        <p className="theme-muted text-xs">Stand {updatedAt} Uhr</p>
      </div>
    </Card>
  );
}
