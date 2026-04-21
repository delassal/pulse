"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type TooltipContentProps,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { GymIcon } from "@/components/ui/Icons";
import type { ApiError, GymUsageData } from "@/types";

const LEVEL_TEXT_COLOR: Record<GymUsageData["level"], string> = {
  LOW: "text-[color:var(--success)]",
  MEDIUM: "text-[color:var(--warning)]",
  HIGH: "text-[color:var(--danger)]",
};

const LEVEL_LABEL: Record<GymUsageData["level"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function formatGymTooltipLabel(value: string) {
  const [hours, minutes] = value.split(":");
  return `${hours}:${minutes} Uhr`;
}

function renderGymTooltip() {
  return function TooltipContent({ active, label, payload }: TooltipContentProps) {

    if (!active || !payload?.length) {
      return null;
    }

    const value = payload[0]?.value;

    if (typeof value !== "number") {
      return null;
    }

    return (
      <div className="theme-tooltip rounded-xl px-3 py-2">
        <p className="theme-muted text-xs font-medium">
          {formatGymTooltipLabel(String(label ?? ""))}
        </p>
        <p className="theme-text mt-1 text-sm font-semibold">
          {Math.round(value)}%
        </p>
      </div>
    );
  };
}

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
      <Card title="Gym" subtitle="Current usage" icon={<GymIcon className="h-5 w-5" />}>
        <p className="theme-muted text-sm">Loading gym usage...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Gym" subtitle="Current usage" icon={<GymIcon className="h-5 w-5" />}>
        <p className="text-sm text-[color:var(--danger)]">
          {error?.message ?? "Failed to load gym usage"}
        </p>
      </Card>
    );
  }

  const chartData = data.timeline.map((point) => ({
    label: point.startTime.slice(0, 5),
    percentage: point.percentage,
    isCurrent: point.isCurrent,
  }));

  return (
    <Card title="Gym" subtitle="Fitness First - München Moosach" icon={<GymIcon className="h-5 w-5" />}>
      <div className="space-y-3">
        <p className="theme-text text-3xl font-semibold">
          {Math.round(data.currentPercentage)}%
        </p>
        <p className={`text-sm font-medium ${LEVEL_TEXT_COLOR[data.level]}`}>
          {LEVEL_LABEL[data.level]} occupancy
        </p>
        <p className="theme-muted text-xs">
          {data.day.toUpperCase()} {data.startTime.slice(0, 5)}-
          {data.endTime.slice(0, 5)}
        </p>

        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                interval="preserveStartEnd"
                minTickGap={18}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--accent-soft)" }}
                content={renderGymTooltip()}
              />
              <Bar dataKey="percentage" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={entry.isCurrent ? "var(--accent)" : "var(--subtle)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
