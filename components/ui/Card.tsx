import type { ReactNode } from "react";

interface CardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function Card({ title, subtitle, icon, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          ) : null}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
