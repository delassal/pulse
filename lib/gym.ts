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
  const currentSlot = todayData.data?.items?.find((item) => item.isCurrent);

  if (!currentSlot) {
    throw new Error("No current gym usage slot found");
  }

  return {
    clubId: FITNESS_FIRST_CLUB_ID,
    currentPercentage: currentSlot.percentage,
    level: currentSlot.level,
    day,
    startTime: currentSlot.startTime,
    endTime: currentSlot.endTime,
    updatedAt: new Date().toISOString(),
  };
}
