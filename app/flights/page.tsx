import type { Metadata } from "next";
import Link from "next/link";
import { FlightExplorer } from "@/components/flights/FlightExplorer";
import { PlaneIcon } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "Flights from Munich · Pulse",
  description: "Cheapest cached fares from Munich to every destination for the next 12 months, crawled daily",
};

export default function FlightsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start">
          <Link href="/dashboard" className="theme-subtle text-sm hover:underline">
            ← Pulse
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="theme-icon-shell flex h-10 w-10 flex-none items-center justify-center rounded-xl">
              <PlaneIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold">Flights from Munich</h1>
          </div>
          <p className="theme-subtle mt-2 text-sm">
            Cheapest fare to every destination for the next 12 months, crawled every morning.
          </p>
        </div>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </header>

      <FlightExplorer />

      <div className="mt-8 flex justify-center sm:hidden">
        <ThemeToggle />
      </div>
    </main>
  );
}
