# API Endpoints

This document lists all internal API routes used by Pulse.

## GET /api/etf

Purpose: Returns normalized data for the configured ETFs (S&P 500 IDUS.L, STOXX 600 EXSA.DE, EM IMI EIMU.L). Sourced from the Yahoo Finance chart API.

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
- history: { date: string; price: number }[]
- fullHistory: { date: string; price: number }[]
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

Purpose: Returns travel advisories from four foreign ministries, joined per country, for the `/travel` world map. (The dashboard travel card is a static link and does not call it.)

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
