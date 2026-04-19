import { EtfWidget } from "@/components/widgets/EtfWidget";
import { GymWidget } from "@/components/widgets/GymWidget";
import { MacroWidget } from "@/components/widgets/MacroWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Morning Briefing
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Pulse Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your quick snapshot of market, macro, and weather signals.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-2">
          <EtfWidget />
        </div>
        <WeatherWidget />
        <GymWidget />
        <div className="sm:col-span-2 lg:col-span-3">
          <MacroWidget />
        </div>
      </section>
    </main>
  );
}
