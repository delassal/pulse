import type { ReactNode } from "react";

interface CardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function Card({ title, subtitle, icon, children }: CardProps) {
  return (
    <section className="theme-surface min-w-0 rounded-2xl p-4 sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="theme-icon-shell mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="theme-muted text-xs font-medium uppercase tracking-wide">
              {title}
            </p>
            {subtitle ? (
              <p className="theme-subtle truncate text-xs">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
