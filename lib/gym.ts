import type { GymUsageData, GymUsageLevel } from "@/types";

const FITNESS_FIRST_CLUB_ID = "2405764950";
const FITNESS_FIRST_USAGE_URL =
  `https://www.fitnessfirst.de/club/api/usage/week/${FITNESS_FIRST_CLUB_ID}`;

interface GymUsageItem {
  startTime: string;
  endTime: string;
  percentage: number;
  level: GymUsageLevel;
  isCurrent: boolean;
  isFuture: boolean;
}

interface GymUsageDay {
  data?: {
    items?: GymUsageItem[];
  };
  isToday?: boolean;
}

interface GymUsageApiResponse {
  data?: Record<string, GymUsageDay>;
}

export async function getGymUsageData(): Promise<GymUsageData> {
  const response = await fetch(FITNESS_FIRST_USAGE_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch gym usage data");
  }

  const payload = (await response.json()) as GymUsageApiResponse;
  const entries = Object.entries(payload.data ?? {});

  const todayEntry = entries.find(([, day]) => day.isToday);
  if (!todayEntry) {
    throw new Error("No current day data in gym usage response");
  }

  const [day, todayData] = todayEntry;
  const timeline = (todayData.data?.items ?? []).filter((item) => {
    // Drop the rollover slot (for example 23:00-00:00) so the chart ends at closing time.
    return item.endTime > item.startTime;
  });
  const currentSlot = timeline.find((item) => item.isCurrent);

  if (timeline.length === 0) {
    throw new Error("No gym usage timeline found for current day");
  }

  const chartStartTime = timeline[0].startTime;
  const chartEndTime = timeline[timeline.length - 1].endTime;

  return {
    clubId: FITNESS_FIRST_CLUB_ID,
    currentPercentage: currentSlot?.percentage ?? null,
    level: currentSlot?.level ?? null,
    isOpen: Boolean(currentSlot),
    day,
    startTime: chartStartTime,
    endTime: chartEndTime,
    timeline: timeline.map((item) => ({
      startTime: item.startTime,
      endTime: item.endTime,
      percentage: item.percentage,
      level: item.level,
      isCurrent: item.isCurrent,
    })),
    updatedAt: new Date().toISOString(),
  };
}
