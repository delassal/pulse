# API Endpoints

This document lists all internal API routes used by Pulse.

## GET /api/etf

Purpose: Returns normalized ETF data for VWCE.DE.

Response:
- symbol: string
- name: string
- currency: string
- price: number
- dailyChangePct: number
- trend: up | down | flat
- history: { date: string; price: number }[]
- updatedAt: string (ISO timestamp)

## GET /api/macro

Purpose: Returns grouped market + macro indicators for a concise morning briefing. ECB is preferred for inflation/policy rate, with FRED fallback.

Response:
- marketsToday: { id: string; label: string; value: number; change?: number; unit: string }[]
- macroEnvironment: { id: string; label: string; value: number; change?: number; unit: string }[]
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

## Error format

All routes return this shape on server-side errors:

- error: string
