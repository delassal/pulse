"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import type { ApiError, GymUsageData } from "@/types";

const LEVEL_TEXT_COLOR: Record<GymUsageData["level"], string> = {
  LOW: "text-emerald-600",
  MEDIUM: "text-amber-600",
  HIGH: "text-rose-600",
};

const LEVEL_LABEL: Record<GymUsageData["level"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function GymWidget() {
  const { data, isLoading, isError, error } = useQuery<GymUsageData, Error>({
    queryKey: ["gym", "usage", "2405764950"],
    queryFn: async () => {
      const response = await fetch("/api/gym");
      const payload = (await response.json()) as GymUsageData | ApiError;

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Gym usage request failed",
        );
      }

      return payload as GymUsageData;
    },
  });

  if (isLoading) {
    return (
      <Card title="Gym" subtitle="Current usage">
        <p className="text-sm text-slate-500">Loading gym usage...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Gym" subtitle="Current usage">
        <p className="text-sm text-red-600">
          {error?.message ?? "Failed to load gym usage"}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Gym" subtitle={`Club ${data.clubId}`}>
      <div className="space-y-2">
        <p className="text-3xl font-semibold text-slate-900">
          {Math.round(data.currentPercentage)}%
        </p>
        <p className={`text-sm font-medium ${LEVEL_TEXT_COLOR[data.level]}`}>
          {LEVEL_LABEL[data.level]} occupancy
        </p>
        <p className="text-xs text-slate-500">
          {data.day.toUpperCase()} {data.startTime.slice(0, 5)}-
          {data.endTime.slice(0, 5)}
        </p>
      </div>
    </Card>
  );
}
