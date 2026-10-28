import type { FlightDestination, FlightFare } from "@/types";

/** Client-safe helpers shared by the crawler and the /flights page. */

export interface CheapestFares {
  oneWay: { fare: FlightFare; month: string } | null;
  roundTrip: { fare: FlightFare; month: string } | null;
}

/** Cheapest one-way and round-trip fare of a destination across all months. */
export function cheapestFares(destination: FlightDestination): CheapestFares {
  const result: CheapestFares = { oneWay: null, roundTrip: null };
  for (const [month, fares] of Object.entries(destination.months)) {
    for (const key of ["oneWay", "roundTrip"] as const) {
      const fare = fares[key];
      if (fare && (!result[key] || fare.price < result[key].fare.price)) {
        result[key] = { fare, month };
      }
    }
  }
  return result;
}
