# Pulse

Pulse is a mobile-first personal morning-briefing dashboard MVP. It surfaces a quick daily snapshot:

- Daily briefing: greeting, Munich weather, and world news headlines
- ETF snapshot for three positions (S&P 500, STOXX 600, EM IMI)
- Macro & markets briefing (daily market pulse + structural macro context)
- M-Bäder pool occupancy (Munich)
- Fitness First gym occupancy (club 2405764950, München Moosach)
- Travel advisories world map (`/travel`): Germany, US, Canada and UK side by side
- Flights from Munich (`/flights`): cheapest cached fare to every destination for the next 12 months, crawled daily

Built with:

- Next.js 16.2 (App Router)
- React 19.2
- TypeScript (strict)
- Tailwind CSS v4
- TanStack Query v5
- Recharts v3

All dashboard data sources are public. Only the flight crawler needs configuration (see below).

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
		news/route.ts
		pool/route.ts
		travel/route.ts
		weather/route.ts
	dashboard/page.tsx
	travel/page.tsx
	globals.css
	layout.tsx
	page.tsx
	providers.tsx

components/
	theme/
		ThemeProvider.tsx
	ui/
		Card.tsx
		Icons.tsx
		LastUpdated.tsx
		RefreshButton.tsx
		ThemeToggle.tsx
	widgets/
		DailyBriefingWidget.tsx
		EtfWidget.tsx
		GymWidget.tsx
		MacroWidget.tsx
		PoolWidget.tsx
		WeatherWidget.tsx

lib/
	etf.ts
	gym.ts
	macro/
	news.ts
	pool.ts
	weather.ts
	utils.ts

docs/
	api-endpoints.md

types/
	index.ts
```

## Architecture

- `lib/`: external API calls and normalization only.
- `app/api`: internal API routes that call `lib/`, apply per-route caching, and return normalized JSON.
- `components/`: UI-only components, no external API calls.
- `app/dashboard`: page composition layer.

See [CLAUDE.md](CLAUDE.md) for the authoritative architecture, caching, and theming conventions.

## Data Sources

- ETF: Yahoo Finance chart API (S&P 500 IDUS.L, STOXX 600 EXSA.DE, EM IMI EIMU.L)
- Macro: FRED CSV (primary), BLS API for US CPI, CBR HTML scrape for Russia
- Weather: Open-Meteo geocoding + forecast APIs (default city: Munich)
- News: BBC World News RSS feed
- Pool: SWM + ticos-systems visitor-count APIs (M-Bäder)
- Gym: Fitness First usage API (club week endpoint)
- Flights: Travelpayouts (Aviasales) Data API, `prices_for_dates` with `unique=true` (one cheapest fare per destination and month)
- Travel: Auswärtiges Amt Open Data, US State Department advisory RSS, Global Affairs Canada open data, UK FCDO travel advice (GOV.UK Content API)

## Notes

- Widgets fetch from internal routes via TanStack Query.
- Default query refresh interval is 60 seconds.
- ETF and macro widgets include compact Recharts charts.

## Deploy to Vercel

1. Push repository to GitHub.
2. Import project into Vercel.
3. Build command: `npm run build`
4. Output: default Next.js output

### Flight crawler setup

The crawler (`/api/flights/crawl`) runs daily at 05:00 UTC via Vercel Cron (`vercel.json`). Each run makes 24 requests (12 months x one-way/round trip) and stores the result in a private Vercel Blob store:

- `flights/latest.json`: newest snapshot, read by `/flights`
- `flights/history.json`: cheapest fare per destination per day (last 400 days)
- `flights/snapshots/YYYY-MM-DD.json`: daily archive

Environment variables:

| Variable | Purpose |
| --- | --- |
| `TRAVELPAYOUTS_TOKEN` | API token from travelpayouts.com (Profile, API token) |
| `CRON_SECRET` | Random string; Vercel Cron sends it as Bearer token |
| `BLOB_READ_WRITE_TOKEN` | Set automatically when a Blob store is connected to the project |
| `FLIGHTS_MARKET` | Optional Aviasales market, default `de` |

Trigger a run manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/flights/crawl`
