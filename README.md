# Pulse

Pulse is a mobile-first personal morning-briefing dashboard MVP. It surfaces a quick daily snapshot:

- Daily briefing: greeting, Munich weather, and world news headlines
- ETF snapshot for three positions (S&P 500, STOXX 600, EM IMI)
- Macro & markets briefing (daily market pulse + structural macro context)
- M-Bäder pool occupancy (Munich)
- Fitness First gym occupancy (club 2405764950, München Moosach)
- Travel advisories world map (`/travel`): Germany, US, Canada and UK side by side, with a log of level changes
- Flights from Munich (`/flights`): cheapest cached fare to every destination for the next 12 months, crawled daily; filter by month, trip length and price

Built with:

- Next.js 16.2 (App Router)
- React 19.2
- TypeScript (strict)
- Tailwind CSS v4
- TanStack Query v5
- Recharts v3

All dashboard data sources are public. Only the two daily jobs (flight crawler, travel advisory tracking) need configuration (see below).

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
		flights/route.ts            full snapshot for /flights
		flights/summary/route.ts    top fares for the dashboard card
		flights/crawl/route.ts      daily cron
		gym/route.ts
		macro/route.ts
		news/route.ts
		pool/route.ts
		travel/route.ts
		travel/changes/route.ts     level change log
		travel/track/route.ts       daily cron
		weather/route.ts
	dashboard/page.tsx
	flights/page.tsx
	travel/page.tsx
	globals.css
	layout.tsx
	page.tsx
	providers.tsx

components/
	flights/                      FlightExplorer
	theme/                        ThemeProvider
	travel/                       TravelExplorer, TravelMap, TravelChanges, Swatch
	ui/                           Card, Flag, Icons, LastUpdated, RefreshButton, ThemeToggle, useChartSize
	widgets/                      DailyBriefing, Etf, Flights, Gym, Macro, Pool, Travel

data/
	travel-history-seed.json      starting point of the advisory change log

lib/
	blob-store.ts                 JSON in the private Vercel Blob store
	etf.ts
	flights.ts, flights-store.ts, flight-utils.ts
	gym.ts
	macro/
	news.ts
	pool.ts
	travel.ts, travel-changes.ts, travel-store.ts, travel-meta.ts
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
- Flights: Travelpayouts (Aviasales) Data API, `prices_for_dates`: with `unique=true` for one cheapest fare per destination and month, then per route for the cheapest round trip per length of stay. Fare cards link the same dates on Trip.com and Google Flights; neither offers a public price API, so they are not crawled
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

The crawler (`/api/flights/crawl`) runs daily at 05:00 UTC via Vercel Cron (`vercel.json`). Each run makes 24 requests for the month overview (12 months x one-way/round trip), followed by a paced pass of about 1,100 requests (one per route and month) for the cheapest round trip per length of stay; that pass is time-boxed, and what it does not reach catches up on the following days. The result is stored in a private Vercel Blob store:

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

### Travel advisory tracking

`/api/travel/track` runs daily at 05:30 UTC via Vercel Cron. It compares the advisories with the last levels on record and appends every level change to `travel/history.json` in the same Blob store (uses `CRON_SECRET` and the Blob token, nothing else). Until the first run, the change log is served from `data/travel-history-seed.json`.

Trigger a run manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/travel/track`
