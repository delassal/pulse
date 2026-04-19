# Pulse

Pulse is a mobile-first personal dashboard MVP that surfaces a quick morning briefing:

- ETF snapshot for VWCE.DE
- Macro indicators (EU-first with fallback)
- Weather for a configurable city (default: Munich)
- Current gym occupancy for Fitness First club 2405764950

Built with:

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query
- Recharts

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 (it redirects to /dashboard).

## Build

```bash
npm run build
npm run start
```

## Project Structure

```text
app/
	api/
		etf/route.ts
		gym/route.ts
		macro/route.ts
		weather/route.ts
	dashboard/page.tsx
	globals.css
	layout.tsx
	page.tsx
	providers.tsx

components/
	ui/
		Card.tsx
	widgets/
		EtfWidget.tsx
		GymWidget.tsx
		MacroWidget.tsx
		WeatherWidget.tsx

lib/
	etf.ts
	gym.ts
	macro.ts
	weather.ts
	utils.ts

docs/
	api-endpoints.md

types/
	index.ts
```

## Architecture

- `lib/`: external API calls and normalization only.
- `app/api`: internal API routes that call `lib/` and return normalized JSON.
- `components/`: UI-only components, no external API calls.
- `app/dashboard`: page composition layer.

## Data Sources

- ETF: Stooq CSV feed (`VWCE.DE`)
- Macro: ECB Data API (preferred), FRED CSV fallback
- Weather: Open-Meteo geocoding + forecast APIs
- Gym usage: Fitness First usage API (club week endpoint)

## Notes

- Widgets fetch from internal routes via TanStack Query.
- Default query refresh interval is 60 seconds.
- ETF widget includes a compact Recharts line chart.

## Deploy to Vercel

1. Push repository to GitHub.
2. Import project into Vercel.
3. Build command: `npm run build`
4. Output: default Next.js output

No extra environment variables are required for the current MVP data sources.
