import Link from "next/link";
import { Flag } from "@/components/travel/Flag";
import { Card } from "@/components/ui/Card";
import { TravelIcon } from "@/components/ui/Icons";
import { TRAVEL_VIEWS } from "@/lib/travel-meta";

/** Entry point to /travel. Static on purpose: the advisory data is only loaded on the map page. */
export function TravelWidget() {
  return (
    <Link
      href="/travel"
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
    >
      <Card
        title="Travel advisories"
        subtitle="World map of official travel warnings"
        icon={<TravelIcon className="h-5 w-5" />}
      >
        <div className="flex items-center justify-between gap-3">
          <ul className="flex items-center gap-2" aria-label="Sources">
            {TRAVEL_VIEWS.map((view) => (
              <li key={view.id} title={view.label}>
                <Flag source={view.id} className="h-3.5 w-[18px]" />
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium text-[color:var(--accent)]">Open world map →</p>
        </div>
      </Card>
    </Link>
  );
}
