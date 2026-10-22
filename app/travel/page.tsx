import type { Metadata } from "next";
import Link from "next/link";
import { TravelExplorer } from "@/components/travel/TravelExplorer";
import { TravelIcon } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "Travel advisories · Pulse",
  description:
    "World map comparing travel advisories from Germany, the United States, Canada and the United Kingdom",
  // Replaces the root layout's icons for this page (metadata is merged shallowly).
  icons: { icon: "/travel-icon.svg" },
};

export default function TravelPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start">
          <Link href="/dashboard" className="theme-subtle text-sm hover:underline">
            ← Pulse
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="theme-icon-shell flex h-10 w-10 flex-none items-center justify-center rounded-xl">
              <TravelIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold">Travel advisories</h1>
          </div>
          <p className="theme-subtle mt-2 text-sm">
            Germany, the US, Canada and the UK side by side, straight from their open data.
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
