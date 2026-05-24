"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiError, NewsData, WeatherData } from "@/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function formattedDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color:var(--border)] ${className ?? ""}`}
    />
  );
}

function WeatherSection() {
  const { data, isLoading } = useQuery<WeatherData, Error>({
    queryKey: ["weather", "Munich"],
    queryFn: async () => {
      const res = await fetch("/api/weather?city=Munich");
      const payload = (await res.json()) as WeatherData | ApiError;
      if (!res.ok) throw new Error("error" in payload ? payload.error : "Weather failed");
      return payload as WeatherData;
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    );
  }

  if (!data) return null;

  const temp = Math.round(data.temperature);

  return (
    <div className="flex flex-col gap-0.5">
      <p className="theme-muted text-xs font-semibold uppercase tracking-[0.16em]">
        Munich
      </p>
      <p className="theme-text text-2xl font-semibold tabular-nums">
        {temp}&deg;C &middot; {data.condition}
      </p>
      {data.forecast && (
        <p className="theme-subtle text-sm tabular-nums">
          {data.forecast.min}&deg; &rarr; {data.forecast.max}&deg;
        </p>
      )}
    </div>
  );
}

function NewsSection() {
  const { data, isLoading } = useQuery<NewsData, Error>({
    queryKey: ["news"],
    queryFn: async () => {
      const res = await fetch("/api/news");
      const payload = (await res.json()) as NewsData | ApiError;
      if (!res.ok) throw new Error("error" in payload ? payload.error : "News failed");
      return payload as NewsData;
    },
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.items.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="theme-muted text-xs font-semibold uppercase tracking-[0.16em]">
        {data.source}
      </p>
      <ul className="flex flex-col gap-1.5">
        {data.items.map((item, i) => (
          <li key={i} className="text-sm leading-snug">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="theme-subtle hover:text-[color:var(--accent)] transition-colors line-clamp-1"
              >
                {item.title}
              </a>
            ) : (
              <span className="theme-subtle line-clamp-1">{item.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyBriefingWidget() {
  return (
    <div
      className="theme-surface mb-6 w-full rounded-2xl px-5 py-4 shadow-[var(--shadow)]"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-0 sm:divide-x sm:divide-[color:var(--border)]">
        {/* Greeting + date */}
        <div className="flex flex-col justify-center gap-0.5 sm:pr-6">
          <p className="theme-text text-base font-semibold">
            {greeting()}, Daniel
          </p>
          <p className="theme-subtle text-sm">{formattedDate()}</p>
        </div>

        {/* Weather */}
        <div className="sm:px-6">
          <WeatherSection />
        </div>

        {/* News */}
        <div className="sm:pl-6 sm:flex-1">
          <NewsSection />
        </div>
      </div>
    </div>
  );
}
