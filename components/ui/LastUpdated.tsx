"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

function mostRecentDataUpdatedAt(
  queryClient: ReturnType<typeof useQueryClient>,
): number | null {
  const timestamps = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.state.dataUpdatedAt)
    .filter((timestamp) => timestamp > 0);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function formatRelativeTime(timestamp: number, now: number) {
  const diffSeconds = Math.max(0, Math.round((now - timestamp) / 1000));

  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours}h ago`;
}

export function LastUpdated() {
  const queryClient = useQueryClient();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(() =>
    mostRecentDataUpdatedAt(queryClient),
  );
  const [now, setNow] = useState<number | null>(() => Date.now());

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      setLastUpdatedAt(mostRecentDataUpdatedAt(queryClient));
    });

    const interval = setInterval(() => setNow(Date.now()), 15_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queryClient]);

  if (lastUpdatedAt === null || now === null) return null;

  return (
    <p className="theme-subtle text-xs" suppressHydrationWarning>
      Updated {formatRelativeTime(lastUpdatedAt, now)}
    </p>
  );
}
