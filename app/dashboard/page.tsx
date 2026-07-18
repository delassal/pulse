import { ETF_CONFIGS } from "@/lib/etf";
import { EtfWidget } from "@/components/widgets/EtfWidget";
import { GymWidget } from "@/components/widgets/GymWidget";
import { MacroWidget } from "@/components/widgets/MacroWidget";
import { PoolWidget } from "@/components/widgets/PoolWidget";
import { DailyBriefingWidget } from "@/components/widgets/DailyBriefingWidget";
import { FinancialsIcon, MacroIcon, PersonalIcon } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { LastUpdated } from "@/components/ui/LastUpdated";
import type { ReactNode } from "react";

function SectionHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <header className="mb-3 flex items-start gap-3">
      <div className="theme-icon-shell flex h-10 w-10 flex-none items-center justify-center rounded-2xl shadow-sm">
        {icon}
      </div>
      <div>
        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">
          {title}
        </p>
        <p className="theme-subtle mt-1 text-sm">{description}</p>
      </div>
    </header>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start">
          <h1 className="text-2xl font-semibold">Pulse</h1>
          <p className="theme-subtle mt-5 text-sm">
            Daniel&apos;s quick snapshot of important signals.
          </p>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <LastUpdated />
          <RefreshButton />
          <ThemeToggle />
        </div>
      </header>

      <DailyBriefingWidget />

      <div className="space-y-8">
        <section>
          <SectionHeader
            title="Financials"
            description="Core ETF positions and market exposure."
            icon={<FinancialsIcon className="h-5 w-5" />}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ETF_CONFIGS.map((etf) => (
              <EtfWidget key={etf.isin} etf={etf} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader
            title="Personal"
            description="Health, place, and daily context."
            icon={<PersonalIcon className="h-5 w-5" />}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PoolWidget />
            <GymWidget />
          </div>
        </section>

        <section>
          <SectionHeader
            title="Macro & Markets"
            description="Morning briefing: market pulse first, structural backdrop second."
            icon={<MacroIcon className="h-5 w-5" />}
          />
          <div className="grid grid-cols-1 gap-4">
            <MacroWidget />
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <RefreshButton />
          <ThemeToggle />
        </div>
        <LastUpdated />
      </div>

      <footer className="mt-10 text-center">
        <p className="theme-subtle text-xs">
          Information according to § 5 TMG: Daniel El-Assal, Munich, Germany.
          Contact:{" "}
          <a
            href="https://danielelassal.com"
            className="hover:theme-text underline underline-offset-2"
            target="_blank"
          >
            danielelassal.com
          </a>
        </p>
      </footer>
    </main>
  );
}
