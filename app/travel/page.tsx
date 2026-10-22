import type { Metadata } from "next";
import Link from "next/link";
import { TravelExplorer } from "@/components/travel/TravelExplorer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "Travel advisories · Pulse",
  description: "World map comparing travel advisories from Germany, the United States and Canada",
};

export default function TravelPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start">
          <Link href="/dashboard" className="theme-subtle text-sm hover:underline">
            ← Pulse
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">Travel advisories</h1>
          <p className="theme-subtle mt-2 text-sm">
            Germany, the US and Canada side by side, straight from their open data.
          </p>
        </div>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </header>

      <TravelExplorer />

      <div className="mt-8 flex justify-center sm:hidden">
        <ThemeToggle />
      </div>
    </main>
  );
}
