"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { WeatherIcon } from "@/components/ui/Icons";
import type { ApiError, WeatherData } from "@/types";

export function WeatherWidget() {
  const { data, isLoading, isError, error } = useQuery<WeatherData, Error>({
    queryKey: ["weather", "Munich"],
    queryFn: async () => {
      const response = await fetch("/api/weather?city=Munich");
      const payload = (await response.json()) as WeatherData | ApiError;

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Weather request failed",
        );
      }

      return payload as WeatherData;
    },
  });

  if (isLoading) {
    return (
      <Card title="Weather" subtitle="Munich" icon={<WeatherIcon className="h-5 w-5" />}>
        <p className="theme-muted text-sm">Loading weather...</p>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card title="Weather" subtitle="Munich" icon={<WeatherIcon className="h-5 w-5" />}>
        <p className="text-sm text-[color:var(--danger)]">
          {error?.message ?? "Failed to load weather"}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Weather" subtitle={data.city} icon={<WeatherIcon className="h-5 w-5" />}>
      <div>
        <p className="theme-text text-3xl font-semibold">
          {Math.round(data.temperature)}&deg;{data.unit}
        </p>
        <p className="theme-subtle mt-1 text-sm">{data.condition}</p>
      </div>
    </Card>
  );
}
