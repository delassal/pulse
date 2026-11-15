import type {
  FlightDestination,
  FlightFare,
  FlightMonthFares,
  FlightSnapshot,
  FlightStay,
  FlightSummaryFare,
} from "@/types";

/** Client-safe helpers shared by the crawler and the /flights page. */

export type FlightTrip = "oneWay" | "roundTrip";

export const FLIGHT_STAYS: Array<{ id: FlightStay; label: string; maxNights: number }> = [
  { id: "short", label: "Up to 4 nights", maxNights: 4 },
  { id: "week", label: "5 to 9 nights", maxNights: 9 },
  { id: "twoWeeks", label: "10 to 16 nights", maxNights: 16 },
  { id: "long", label: "17 nights or more", maxNights: Infinity },
];

function utcDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Nights between the departure and the return date as printed on the ticket (local dates). */
export function stayNights(departureAt: string, returnAt: string | null | undefined): number | null {
  if (!returnAt) return null;
  const nights = Math.round((utcDay(returnAt) - utcDay(departureAt)) / 86_400_000);
  return Number.isFinite(nights) && nights >= 0 ? nights : null;
}

export function stayFor(nights: number): FlightStay {
  return FLIGHT_STAYS.find((stay) => nights <= stay.maxNights)!.id;
}

/**
 * The fare of one destination-month for a trip type and, for round trips, an optional
 * length of stay. Without per-route data the month's cheapest fare still counts when
 * it happens to have the wanted length.
 */
export function fareFor(
  fares: FlightMonthFares | undefined,
  trip: FlightTrip,
  stay: FlightStay | null = null,
): FlightFare | undefined {
  if (!fares) return undefined;
  if (trip === "oneWay" || !stay) return fares[trip];

  const cheapest = fares.roundTrip;
  const nights = cheapest ? stayNights(cheapest.departureAt, cheapest.returnAt) : null;
  const fromCheapest = cheapest && nights !== null && stayFor(nights) === stay ? cheapest : undefined;
  const fromStays = fares.stays?.[stay];

  if (fromCheapest && fromStays) {
    return fromCheapest.price <= fromStays.price ? fromCheapest : fromStays;
  }
  return fromCheapest ?? fromStays;
}

export interface FareMatch {
  fare: FlightFare;
  month: string;
}

/** Cheapest fare of a destination, optionally limited to one month and one length of stay. */
export function cheapestFare(
  destination: FlightDestination,
  trip: FlightTrip,
  { month = null, stay = null }: { month?: string | null; stay?: FlightStay | null } = {},
): FareMatch | null {
  let best: FareMatch | null = null;
  for (const [key, fares] of Object.entries(destination.months)) {
    if (month && key !== month) continue;
    const fare = fareFor(fares, trip, stay);
    if (fare && (!best || fare.price < best.fare.price)) best = { fare, month: key };
  }
  return best;
}

export interface CheapestFares {
  oneWay: FareMatch | null;
  roundTrip: FareMatch | null;
}

/** Cheapest one-way and round-trip fare of a destination across all months. */
export function cheapestFares(destination: FlightDestination): CheapestFares {
  return {
    oneWay: cheapestFare(destination, "oneWay"),
    roundTrip: cheapestFare(destination, "roundTrip"),
  };
}

/** Lengths of stay short enough for an ordinary holiday: everything up to 16 nights. */
const HOLIDAY_STAYS: FlightStay[] = ["short", "week", "twoWeeks"];

/** Cheapest long-haul round trips of up to 16 nights, one per destination. */
export function topLongHaulFares(snapshot: FlightSnapshot, count: number): FlightSummaryFare[] {
  const fares: FlightSummaryFare[] = [];

  for (const destination of Object.values(snapshot.destinations)) {
    if (destination.region === "Europe") continue;

    let best: FareMatch | null = null;
    for (const stay of HOLIDAY_STAYS) {
      const match = cheapestFare(destination, "roundTrip", { stay });
      if (match && (!best || match.fare.price < best.fare.price)) best = match;
    }
    if (!best) continue;

    fares.push({
      code: destination.code,
      name: destination.name,
      price: best.fare.price,
      month: best.month,
      nights: stayNights(best.fare.departureAt, best.fare.returnAt),
    });
  }

  return fares.sort((a, b) => a.price - b.price).slice(0, count);
}
