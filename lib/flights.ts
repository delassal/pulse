import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { cheapestFares, stayFor, stayNights } from "@/lib/flight-utils";
import type {
  FlightDestination,
  FlightFare,
  FlightHistory,
  FlightMonthFares,
  FlightRegion,
  FlightSnapshot,
} from "@/types";

countries.registerLocale(enLocale);

/**
 * Daily fare crawl for Munich: the cheapest cached fare to every destination,
 * per departure month, for the next 12 months, one-way and round trip.
 *
 * Source: Travelpayouts (Aviasales) Data API. Prices are cached from real user
 * searches, not live quotes, which is why one request can cover a whole month
 * and every destination at once (`unique=true` returns one fare per route).
 * 12 months x 2 trip types = 24 requests per crawl (plus pagination).
 *
 * That one fare per route has an arbitrary length of stay (a cheap Bangkok fare may mean
 * staying a month), so a second pass asks for each route-month's own fare list and keeps
 * the cheapest round trip per length of stay. It is one request per route-month (about a
 * thousand), paced and time-boxed; whatever it does not reach is carried over from the
 * previous snapshot and goes first on the next day.
 */

export const FLIGHT_ORIGIN = "MUC";
export const FLIGHT_MONTHS_AHEAD = 12;
const HISTORY_MAX_DAYS = 400;

const PRICES_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const CITIES_URL = "https://api.travelpayouts.com/data/en/cities.json";
const AVIASALES_BASE = "https://www.aviasales.com";
const PAGE_LIMIT = 1000;
const MAX_PAGES = 3;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 25_000;

// Per-route pass (lengths of stay).
const STAY_CONCURRENCY = 6;
/** Minimum gap between request starts: about 270 requests a minute. */
const STAY_PACE_MS = 220;
/** The whole crawl must finish inside the route's maxDuration (300 s), blob writes included. */
const CRAWL_TIME_BUDGET_MS = 230_000;
const STAY_RATE_LIMIT_PAUSE_MS = 15_000;
const STAY_MAX_RATE_LIMITS = 3;
/** Give up when the pass starts with this many failures in a row (wrong parameters, outage). */
const STAY_MAX_INITIAL_FAILURES = 12;
/** Carried-over stay fares older than this are dropped. */
const STAY_MAX_AGE_DAYS = 4;

interface RawFare {
  origin: string;
  destination: string;
  price: number;
  airline?: string;
  departure_at: string;
  return_at?: string | null;
  transfers?: number;
  return_transfers?: number | null;
  duration?: number | null;
  link?: string;
}

interface RawCity {
  code: string;
  name: string | null;
  country_code: string;
  time_zone: string | null;
  name_translations?: { en?: string };
}

interface CityInfo {
  name: string;
  countryCode: string;
  timeZone: string | null;
}

/** First day of the current month and the following months, as YYYY-MM. */
export function upcomingMonths(now = new Date(), count = FLIGHT_MONTHS_AHEAD): string[] {
  const months: string[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

class RateLimitError extends Error {}

async function fetchPrices(
  token: string,
  query: Record<string, string>,
  label: string,
): Promise<RawFare[]> {
  const params = new URLSearchParams({
    origin: FLIGHT_ORIGIN,
    sorting: "price",
    direct: "false",
    currency: "eur",
    market: process.env.FLIGHTS_MARKET ?? "de",
    limit: String(PAGE_LIMIT),
    ...query,
  });

  const response = await fetch(`${PRICES_URL}?${params}`, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (response.status === 429) {
    throw new RateLimitError(`Travelpayouts ${label}: rate limited (HTTP 429)`);
  }
  if (!response.ok) {
    throw new Error(`Travelpayouts ${label}: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { success?: boolean; data?: RawFare[]; error?: string };
  if (json.success === false) {
    throw new Error(`Travelpayouts ${label}: ${json.error ?? "request failed"}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

/** One page of the cheapest fare per destination for a departure month. */
function fetchFarePage(token: string, month: string, oneWay: boolean, page: number) {
  return fetchPrices(
    token,
    { departure_at: month, one_way: String(oneWay), unique: "true", page: String(page) },
    `${month} ${oneWay ? "OW" : "RT"} p${page}`,
  );
}

/** Every cached round trip of one route in a departure month, cheapest first. */
function fetchRouteMonth(token: string, destination: string, month: string) {
  return fetchPrices(
    token,
    { destination, departure_at: month, one_way: "false", page: "1" },
    `${destination} ${month}`,
  );
}

async function fetchMonth(token: string, month: string, oneWay: boolean): Promise<RawFare[]> {
  const fares: RawFare[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchFarePage(token, month, oneWay, page);
    fares.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
  }
  return fares;
}

async function fetchCities(): Promise<Map<string, CityInfo>> {
  const cities = new Map<string, CityInfo>();
  try {
    const response = await fetch(CITIES_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return cities;
    const raw = (await response.json()) as RawCity[];
    for (const city of raw) {
      cities.set(city.code, {
        name: city.name_translations?.en || city.name || city.code,
        countryCode: city.country_code,
        timeZone: city.time_zone,
      });
    }
  } catch {
    // Names are cosmetic; the crawl still works with bare IATA codes.
  }
  return cities;
}

const MIDDLE_EAST = new Set([
  "AE", "BH", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "YE",
]);
const EUROPE_EXTRA = new Set(["CY", "TR", "IS", "PT", "ES", "FO", "GB", "IE", "RU"]);
const AFRICA_EXTRA = new Set(["CV", "MU", "SC", "RE", "MG", "KM", "YT", "ST"]);
const AMERICAS_EXTRA = new Set(["BM"]);

function regionFor(countryCode: string, timeZone: string | null): FlightRegion {
  if (MIDDLE_EAST.has(countryCode)) return "Middle East";
  if (EUROPE_EXTRA.has(countryCode)) return "Europe";
  if (AFRICA_EXTRA.has(countryCode)) return "Africa";
  if (AMERICAS_EXTRA.has(countryCode)) return "Americas";

  const zone = timeZone?.split("/")[0];
  switch (zone) {
    case "Europe":
      return "Europe";
    case "Africa":
      return "Africa";
    case "America":
      return "Americas";
    case "Australia":
    case "Pacific":
      return "Oceania";
    default:
      return "Asia";
  }
}

/** "2026-11-24T10:30:00+01:00" -> "2411", the date format of Aviasales search paths. */
function searchDay(iso: string) {
  return `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
}

/** Plain Aviasales search for the fare's dates: a fraction of the size of the API's deep link. */
function searchLink(destination: string, departureAt: string, returnAt: string | null) {
  const back = returnAt ? searchDay(returnAt) : "";
  return `${AVIASALES_BASE}/search/${FLIGHT_ORIGIN}${searchDay(departureAt)}${destination}${back}1`;
}

function normalizeFare(raw: RawFare, oneWay: boolean): FlightFare {
  const returnTrip = !oneWay && raw.return_at ? raw.return_at : null;
  return {
    price: Math.round(raw.price),
    departureAt: raw.departure_at,
    returnAt: returnTrip,
    airline: raw.airline ?? "",
    transfers: raw.transfers ?? 0,
    returnTransfers: returnTrip ? (raw.return_transfers ?? null) : null,
    duration: raw.duration ?? null,
    link: raw.link ? `${AVIASALES_BASE}${raw.link}` : AVIASALES_BASE,
  };
}

/** Runs async jobs with a fixed number of workers so we stay polite to the API. */
async function runPool<T>(jobs: Array<() => Promise<T>>, concurrency: number) {
  const results: Array<PromiseSettledResult<T>> = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await jobs[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

export { cheapestFares };

interface StayTask {
  code: string;
  month: string;
  fares: FlightMonthFares;
  /** Day this route-month's stay fares were last crawled ("" = never). */
  lastCrawled: string;
  longHaul: boolean;
}

function daysBetween(fromDay: string, toDay: string) {
  return Math.round((Date.parse(toDay) - Date.parse(fromDay)) / 86_400_000);
}

/**
 * Second pass: the cheapest round trip per length of stay for every route-month that has
 * a round-trip fare. Mutates `destinations`. Never throws; the base crawl stands on its own.
 */
async function crawlStays(
  token: string,
  destinations: Record<string, FlightDestination>,
  previous: FlightSnapshot | null,
  today: string,
  deadline: number,
): Promise<{ refreshed: number; total: number; requests: number; failed: number; errors: string[] }> {
  const tasks: StayTask[] = [];
  for (const destination of Object.values(destinations)) {
    for (const [month, fares] of Object.entries(destination.months)) {
      if (!fares.roundTrip) continue;
      const before = previous?.destinations[destination.code]?.months[month];
      tasks.push({
        code: destination.code,
        month,
        fares,
        lastCrawled: before?.stays && before.staysAt ? before.staysAt : "",
        longHaul: destination.region !== "Europe",
      });

      // Until refreshed below, keep recent stay fares from the previous snapshot.
      if (
        before?.stays &&
        before.staysAt &&
        daysBetween(before.staysAt, today) <= STAY_MAX_AGE_DAYS
      ) {
        fares.stays = before.stays;
        fares.staysAt = before.staysAt;
      }
    }
  }

  // Longest-waiting first, so a day that runs out of time is made up for on the next one;
  // within that, long-haul first (where the length of stay matters most), then cheapest.
  tasks.sort(
    (a, b) =>
      a.lastCrawled.localeCompare(b.lastCrawled) ||
      Number(b.longHaul) - Number(a.longHaul) ||
      a.fares.roundTrip!.price - b.fares.roundTrip!.price,
  );

  const errors: string[] = [];
  let next = 0;
  let nextStart = Date.now();
  let pausedUntil = 0;
  let rateLimits = 0;
  let refreshed = 0;
  let requests = 0;
  let failed = 0;
  let aborted = false;

  async function worker() {
    while (!aborted && next < tasks.length) {
      // Claim a paced start slot; stop once the request could no longer finish in time.
      const start = Math.max(nextStart, pausedUntil, Date.now());
      if (start + REQUEST_TIMEOUT_MS > deadline) return;
      nextStart = start + STAY_PACE_MS;
      const task = tasks[next++];
      await new Promise((resolve) => setTimeout(resolve, start - Date.now()));
      if (aborted) return;

      requests += 1;
      try {
        const fares = await fetchRouteMonth(token, task.code, task.month);
        const stays: NonNullable<FlightMonthFares["stays"]> = {};
        for (const raw of fares) {
          if (!Number.isFinite(raw.price) || raw.price <= 0) continue;
          if (!raw.departure_at?.startsWith(task.month) || !raw.return_at) continue;
          const nights = stayNights(raw.departure_at, raw.return_at);
          if (nights === null) continue;
          const stay = stayFor(nights);
          if (!stays[stay] || raw.price < stays[stay].price) {
            stays[stay] = {
              ...normalizeFare(raw, false),
              link: searchLink(task.code, raw.departure_at, raw.return_at),
            };
          }
        }
        task.fares.stays = stays;
        task.fares.staysAt = today;
        refreshed += 1;
      } catch (reason) {
        failed += 1;
        if (reason instanceof RateLimitError) {
          rateLimits += 1;
          pausedUntil = Date.now() + STAY_RATE_LIMIT_PAUSE_MS;
        }
        if (errors.length < 20) {
          errors.push(reason instanceof Error ? reason.message : String(reason));
        }
        if (
          rateLimits >= STAY_MAX_RATE_LIMITS ||
          (refreshed === 0 && requests >= STAY_MAX_INITIAL_FAILURES)
        ) {
          aborted = true;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(STAY_CONCURRENCY, tasks.length) }, worker));
  return { refreshed, total: tasks.length, requests, failed, errors };
}

export async function crawlFlights(
  token: string,
  now = new Date(),
  previous: FlightSnapshot | null = null,
): Promise<{
  snapshot: FlightSnapshot;
  errors: string[];
}> {
  const deadline = Date.now() + CRAWL_TIME_BUDGET_MS;
  const months = upcomingMonths(now);
  const tasks = months.flatMap((month) =>
    [true, false].map((oneWay) => ({ month, oneWay })),
  );

  const [cities, results] = await Promise.all([
    fetchCities(),
    runPool(
      tasks.map(({ month, oneWay }) => () => fetchMonth(token, month, oneWay)),
      CONCURRENCY,
    ),
  ]);

  const destinations: Record<string, FlightDestination> = {};
  const errors: string[] = [];

  results.forEach((result, index) => {
    const { month, oneWay } = tasks[index];
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      return;
    }

    for (const raw of result.value) {
      if (!raw.destination || !Number.isFinite(raw.price) || raw.price <= 0) continue;
      // The API can return fares whose date drifted outside the requested month.
      if (!raw.departure_at?.startsWith(month)) continue;

      const code = raw.destination;
      let destination = destinations[code];
      if (!destination) {
        const city = cities.get(code);
        const countryCode = city?.countryCode ?? "";
        destination = {
          code,
          name: city?.name ?? code,
          country: (countryCode && countries.getName(countryCode, "en")) || countryCode,
          countryCode,
          region: regionFor(countryCode, city?.timeZone ?? null),
          months: {},
        };
        destinations[code] = destination;
      }

      const slot = (destination.months[month] ??= {});
      const key = oneWay ? "oneWay" : "roundTrip";
      const fare = normalizeFare(raw, oneWay);
      const existing = slot[key];
      if (!existing || fare.price < existing.price) {
        slot[key] = fare;
      }
    }
  });

  const failedRequests = errors.length;
  const stays = await crawlStays(
    token,
    destinations,
    previous,
    now.toISOString().slice(0, 10),
    deadline,
  );
  errors.push(...stays.errors);

  return {
    snapshot: {
      origin: FLIGHT_ORIGIN,
      currency: "EUR",
      crawledAt: now.toISOString(),
      months,
      requests: tasks.length + stays.requests,
      failedRequests: failedRequests + stays.failed,
      stayRoutes: { refreshed: stays.refreshed, total: stays.total },
      destinations,
    },
    errors,
  };
}

/** Appends (or replaces) today's row in the long-running price history. */
export function appendHistory(
  history: FlightHistory | null,
  snapshot: FlightSnapshot,
): FlightHistory {
  const day = snapshot.crawledAt.slice(0, 10);
  const next: FlightHistory = history
    ? { days: [...history.days], series: { ...history.series } }
    : { days: [], series: {} };

  let dayIndex = next.days.indexOf(day);
  if (dayIndex === -1) {
    next.days.push(day);
    dayIndex = next.days.length - 1;
  }

  const width = next.days.length;
  const codes = new Set([...Object.keys(next.series), ...Object.keys(snapshot.destinations)]);

  for (const code of codes) {
    const row = [...(next.series[code] ?? [])];
    while (row.length < width) row.push([null, null]);

    const destination = snapshot.destinations[code];
    if (destination) {
      const cheapest = cheapestFares(destination);
      row[dayIndex] = [cheapest.oneWay?.fare.price ?? null, cheapest.roundTrip?.fare.price ?? null];
    } else {
      row[dayIndex] = [null, null];
    }
    next.series[code] = row;
  }

  // Keep the file bounded: drop the oldest days beyond the retention window.
  const overflow = next.days.length - HISTORY_MAX_DAYS;
  if (overflow > 0) {
    next.days = next.days.slice(overflow);
    for (const code of Object.keys(next.series)) {
      const row = next.series[code].slice(overflow);
      if (row.every(([ow, rt]) => ow === null && rt === null)) {
        delete next.series[code];
      } else {
        next.series[code] = row;
      }
    }
  }

  return next;
}
