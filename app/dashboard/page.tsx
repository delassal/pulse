import { ETF_CONFIGS } from "@/lib/etf";
import { EtfWidget } from "@/components/widgets/EtfWidget";
import { GymWidget } from "@/components/widgets/GymWidget";
import { MacroWidget } from "@/components/widgets/MacroWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { FinancialsIcon, MacroIcon, PersonalIcon } from "@/components/ui/Icons";
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
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </header>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Morning Briefing
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Pulse
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Daniel's quick snapshot of important signals.
        </p>
      </header>

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
            <WeatherWidget />
            <GymWidget />
          </div>
        </section>

        <section>
          <SectionHeader
            title="Macro"
            description="Broader economic backdrop and policy signals."
            icon={<MacroIcon className="h-5 w-5" />}
          />
          <div className="grid grid-cols-1 gap-4">
            <MacroWidget />
          </div>
        </section>
      </div>
    </main>
  );
}
