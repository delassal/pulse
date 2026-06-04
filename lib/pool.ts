import type { OccupancyLevel, PoolArea, PoolData } from "@/types";

interface SWMResponse {
  return_code: string;
  data: Array<{
    customer_amount: number;
    customer_amount_max: number;
  }>;
}

interface TicosEntry {
  personCount: number;
  maxPersonCount: number;
}

function toLevel(pct: number): OccupancyLevel {
  if (pct >= 70) return "HIGH";
  if (pct >= 40) return "MEDIUM";
  return "LOW";
}

async function fetchSWM(areaId: number): Promise<{ current: number; max: number }> {
  const res = await fetch(
    `https://www.swm.de/.rest/bath/visitorCount?area_id=${areaId}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`SWM area ${areaId}: HTTP ${res.status}`);
  const json = (await res.json()) as SWMResponse;
  const d = json.data[0];
  return { current: d.customer_amount, max: d.customer_amount_max };
}

async function fetchTicos(orgUnitId: number): Promise<{ current: number; max: number }> {
  const res = await fetch(
    `https://counter.ticos-systems.cloud/api/gates/counter?organizationUnitIds=${orgUnitId}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`ticos org ${orgUnitId}: HTTP ${res.status}`);
  const json = (await res.json()) as TicosEntry[];
  const d = json[0];
  return { current: d.personCount, max: d.maxPersonCount };
}

function buildArea(id: string, name: string, counts: { current: number; max: number }): PoolArea {
  const percentage = counts.max > 0 ? (counts.current / counts.max) * 100 : 0;
  return { id, name, current: counts.current, max: counts.max, percentage, level: toLevel(percentage) };
}

export async function getPoolData(): Promise<PoolData> {
  const [danteFreibad, danteSauna, olympia] = await Promise.allSettled([
    fetchSWM(36),
    fetchSWM(33),
    fetchTicos(30182),
  ]);

  const pools: PoolArea[] = [];

  if (danteFreibad.status === "fulfilled") {
    pools.push(buildArea("dantebad-freibad", "Dantebad Freibad", danteFreibad.value));
  }
  if (danteSauna.status === "fulfilled") {
    pools.push(buildArea("dantebad-sauna", "Dantebad Sauna", danteSauna.value));
  }
  if (olympia.status === "fulfilled") {
    pools.push(buildArea("olympia", "Olympia-Schwimmhalle", olympia.value));
  }

  return { pools, updatedAt: new Date().toISOString() };
}
