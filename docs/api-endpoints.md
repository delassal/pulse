# API Endpoints

This document lists all internal API routes used by Pulse.

## GET /api/etf

Purpose: Returns normalized data for the configured ETFs (S&P 500 IDUS.L, STOXX 600 EXSA.DE, EM IMI EIMU.L). Sourced from the Yahoo Finance chart API.

Two requests per ETF: `range=10y` (daily closes; day change, YTD, recent closes and calendar years are computed from it) and `range=max` (Yahoo returns monthly bars for it regardless of the requested interval; used for the 5Y and Max charts). Dates are the exchange's calendar dates. All figures are price returns: distributions are not included.

Query parameters:
- isin (optional): return a single ETF object instead of the full array.

Response (array, or a single object when `isin` is provided):
- symbol: string
- name: string
- currency: string
- price: number
- dailyChangePct: number
- ytdChangePct: number
- trend: up | down | flat
- history: { date: string; price: number }[] (daily closes of the current year, led by the previous year's last close, which is the YTD base)
- fullHistory: { date: string; price: number }[] (monthly closes since inception)
- recentCloses: { date: string; price: number; changePct: number }[] (last 6 trading days, newest first; during trading hours the first row is today's running price)
- yearlyPerformance: { year: number; changePct: number }[] (last 5 complete calendar years, oldest first)
- asOf: string (ISO timestamp)
- updatedAt: string (ISO timestamp)

## GET /api/macro

Purpose: Returns grouped market + macro indicators for a concise morning briefing. Regional charts pair inflation with a deposit-facility style rate (direct series where available, closest policy-rate proxy otherwise).

Current indicator set:
- Markets Today: VIX, EUR/USD, Oil (WTI), Gold
- Macro Environment: Inflation + Deposit Facility by region (EU, UK, US, Russia, China), plus PMI

Response:
- marketsToday: { id: string; label: string; value: number; change?: number; unit: string; history?: { date: string; value: number }[] }[]
- regions: { id: "eu" | "uk" | "us" | "russia" | "china"; label: string; inflation: Indicator; policyRate: Indicator; history: { date: string; inflation: number; policyRate: number }[] }[]
- macroEnvironment: flat indicator list used for compatibility and extensions
- indicators: flat list of all indicators (backward-compatibility)
- sources: string[]
- updatedAt: string (ISO timestamp)

## GET /api/weather

Purpose: Returns current weather data for a city.

Query parameters:
- city (optional, default: Munich)

Response:
- city: string
- temperature: number
- unit: string
- condition: string
- weatherCode: number
- updatedAt: string (ISO timestamp)

## GET /api/gym

Purpose: Returns current gym occupancy for Fitness First club 2405764950.

Implementation notes:
- Source endpoint: https://www.fitnessfirst.de/club/api/usage/week/2405764950
- Uses only the current slot from the day marked as today.

Response:
- clubId: string
- currentPercentage: number | null
- level: LOW | MEDIUM | HIGH | null
- isOpen: boolean
- day: string
- startTime: string (HH:mm:ss)
- endTime: string (HH:mm:ss)
- updatedAt: string (ISO timestamp)

## GET /api/news

Purpose: Returns the latest world news headlines for the daily briefing. Sourced from the BBC World News RSS feed.

Response:
- items: { title: string; description: string; url: string; pubDate: string }[] (up to 5)
- source: string

## GET /api/pool

Purpose: Returns current occupancy for the configured M-Bäder areas (Dantebad Freibad, Dantebad Sauna, Olympia-Schwimmhalle). Partial failures are tolerated — only the areas that responded are returned.

Response:
- pools: { id: string; name: string; current: number; max: number; percentage: number; level: LOW | MEDIUM | HIGH }[]
- updatedAt: string (ISO timestamp)

## Error format

All routes return this shape on server-side errors:

- error: string

## GET /api/travel

Purpose: Returns travel advisories from four foreign ministries, joined per country, for the `/travel` world map. (The dashboard travel card does not call it; it only reads `/api/travel/changes`.)

Sources:
- Germany: https://www.auswaertiges-amt.de/opendata/travelwarning (boolean `warning` / `partialWarning` per country, ISO alpha-2 `countryCode`)
- United States: https://travel.state.gov/_res/rss/TAsTWs.xml (title `"<Country> - Level N: <text>"`; country tags are FIPS codes, so countries are matched by name)
- Canada: https://data.international.gc.ca/travel-voyage/index-alpha-eng.json (`advisory-state` 0-3, `has-regional-advisory`)
- United Kingdom: https://www.gov.uk/api/content/foreign-travel-advice (GOV.UK Content API; the index lists ~226 country pages, `details.alert_status` is only on each page, so every page is fetched with a concurrency of 8; countries are matched by name)

Severity is normalised to a shared 1-4 scale for colouring:
- Germany: no warning = 1, partial warning = 3, warning = 4
- United States: level 1-4 as published
- Canada: advisory-state + 1
- United Kingdom: no alert = 1, all but essential travel to parts = 2, all but essential travel to the whole country or all travel to parts = 3, all travel to the whole country = 4 (strictest status wins when several are set)

Implementation notes:
- Sources are fetched in parallel; a failing source is reported in `sources` instead of failing the whole response.
- Complete responses are cached in memory for 1 hour.
- The UK source fails as a whole when more than 10% of its country pages fail; fewer failures just leave those countries without UK data.
- US and UK entries whose names cannot be matched to an ISO code are listed in `sources[].unmatched`; extend `NAME_ALIASES` in `lib/travel.ts` when one shows up.

Response:
- countries: { iso2: string; numeric: string | null; name: string; advisories: { de?: Advisory; us?: Advisory; ca?: Advisory; uk?: Advisory } }[]
  - Advisory: { severity: 1 | 2 | 3 | 4; label: string; regional: boolean; url?: string; updatedAt?: string }
- sources: { id: "de" | "us" | "ca" | "uk"; name: string; ok: boolean; count: number; error?: string; unmatched?: string[] }[]
- updatedAt: string (ISO timestamp)

## GET /api/travel/changes

Purpose: Returns the log of advisory level changes (a source moving a country to another level on the shared 1-4 scale), for the "Level changes" list on `/travel`, the country popup and the dashboard travel card.

The sources only publish their current level, so the history is recorded by `/api/travel/track`. Until its first run has written `travel/history.json` to the Blob store, the log starts from `data/travel-history-seed.json`: US changes since Nov 2025 and Canadian ones since Jul 2026, reconstructed from Internet Archive copies of the feeds, plus all four sources' levels as of 14 Nov 2026. Cached in memory for 1 hour.

Response:
- changes: { date: string (YYYY-MM-DD); iso2: string; name: string; source: "de" | "us" | "ca" | "uk"; from: 1-4; to: 1-4; fromLabel: string; toLabel: string }[] (newest first)
- trackingSince: { de?: string; us?: string; ca?: string; uk?: string } (first day on record per source)
- checkedAt: string | null (ISO timestamp of the last tracking run)

## GET /api/travel/track

Purpose: Daily job (Vercel Cron, 05:30 UTC, `Authorization: Bearer $CRON_SECRET`). Fetches the advisories, compares them with the last levels on record in `travel/history.json` and appends the differences to the change log (`lib/travel-changes.ts`).

Rules:
- A new level is recorded once two consecutive runs agree on it (the feeds occasionally publish a wrong level for a day). It is dated to the source's publication date when that is newer than the levels on record, otherwise to the day it was first seen.
- A source that is unavailable keeps its levels and pending changes untouched; so does a source that would change more than 40 countries in one run (treated as a feed or parser problem).
- Countries missing from a day's feed keep their last level.

## GET /api/flights

Purpose: Returns the latest flight snapshot and the price history for `/flights`. Several megabytes; the dashboard card uses `/api/flights/summary` instead. Cached in memory for 30 minutes.

Response:
- snapshot: { origin; currency; crawledAt; months: string[]; requests; failedRequests; stayRoutes?: { refreshed; total }; destinations: Record<code, Destination> } | null
  - Destination: { code; name; country; countryCode; region; months: Record<YYYY-MM, { oneWay?: Fare; roundTrip?: Fare; stays?: { short?: Fare; week?: Fare; twoWeeks?: Fare; long?: Fare }; staysAt?: string }> }
  - `roundTrip` is the month's cheapest round trip whatever the length of stay; `stays` holds the cheapest one per length of stay (up to 4 nights, 5-9, 10-16, 17 or more)
  - Fare: { price; departureAt; returnAt; airline; transfers; returnTransfers; duration; link }
- history: { days: string[]; series: Record<code, [oneWay | null, roundTrip | null][]> } | null
- notice?: string (set while there is no data yet)

## GET /api/flights/summary

Purpose: Small extract of the snapshot for the dashboard card: the cheapest long-haul (non-European) round trips of up to 16 nights, one per destination. Cached in memory for 30 minutes.

Response:
- top: { code: string; name: string; price: number; month: string (YYYY-MM); nights: number | null }[]
- crawledAt: string | null
- notice?: string

## GET /api/flights/crawl

Purpose: Daily job (Vercel Cron, 05:00 UTC, `Authorization: Bearer $CRON_SECRET`), see the README for setup.

Two passes against the Travelpayouts `prices_for_dates` endpoint:
1. Month overview: 12 months x one-way/round trip with `unique=true` (24 requests), the cheapest fare per destination and month.
2. Lengths of stay: one request per route-month that has a round-trip fare (about 1,100), keeping the cheapest round trip per length of stay. Paced at one request per 220 ms and time-boxed so the whole crawl stays inside the 300 s function limit; route-months it does not reach keep their fares from the previous snapshot (for up to 4 days) and go first on the next run. The pass stops early after three HTTP 429 responses or when its first 12 requests all fail; the month overview is saved either way.
