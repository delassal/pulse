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
