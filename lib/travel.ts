import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type {
  TravelAdvisory,
  TravelAdvisoryData,
  TravelCountry,
  TravelSeverity,
  TravelSourceId,
  TravelSourceStatus,
} from "@/types";

countries.registerLocale(enLocale);

// Germany: Auswärtiges Amt Open Data (only boolean warning flags per country)
const DE_URL = "https://www.auswaertiges-amt.de/opendata/travelwarning";
// United States: State Department travel advisory RSS (levels 1-4, FIPS country tags)
const US_URL = "https://travel.state.gov/_res/rss/TAsTWs.xml";
// Canada: Global Affairs Canada open data (advisory-state 0-3, ISO country keys)
const CA_URL = "https://data.international.gc.ca/travel-voyage/index-alpha-eng.json";

const USER_AGENT =
  "Mozilla/5.0 (compatible; Pulse/1.0; personal dashboard; +https://danielelassal.com)";
const TIMEOUT_MS = 15_000;

const SOURCE_NAMES: Record<TravelSourceId, string> = {
  de: "Germany (Auswärtiges Amt)",
  us: "United States (State Department)",
  ca: "Canada (Global Affairs)",
};

type AdvisoryMap = Map<string, TravelAdvisory>;

interface SourceResult {
  advisories: AdvisoryMap;
  unmatched?: string[];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Upstream responded with ${response.status}`);
  }

  return response.text();
}

function unixToIso(seconds: unknown): string | undefined {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : undefined;
}

// ---------------------------------------------------------------------------
// Germany
// ---------------------------------------------------------------------------

interface DeEntry {
  countryCode?: string;
  countryName?: string;
  warning?: boolean;
  partialWarning?: boolean;
  lastModified?: number;
}

export function parseGermany(json: unknown): SourceResult {
  const response = (json as { response?: Record<string, unknown> })?.response;
  if (!response || typeof response !== "object") {
    throw new Error("Unexpected response shape");
  }

  const advisories: AdvisoryMap = new Map();

  for (const [key, value] of Object.entries(response)) {
    if (!/^\d+$/.test(key) || !value || typeof value !== "object") continue;
    const entry = value as DeEntry;
    const iso2 = entry.countryCode?.toUpperCase();
    if (!iso2) continue;

    let severity: TravelSeverity = 1;
    let label = "No travel warning";
    if (entry.warning) {
      severity = 4;
      label = "Travel warning";
    } else if (entry.partialWarning) {
      severity = 3;
      label = "Partial travel warning";
    }

    advisories.set(iso2, {
      severity,
      label,
      regional: Boolean(entry.partialWarning && !entry.warning),
      updatedAt: unixToIso(entry.lastModified),
    });
  }

  return { advisories };
}

// ---------------------------------------------------------------------------
// United States
// ---------------------------------------------------------------------------

// Names in the US feed that do not resolve through the ISO name table.
const US_NAME_ALIASES: Record<string, string[]> = {
  burma: ["MM"],
  "burma (myanmar)": ["MM"],
  "mainland china": ["CN"],
  "israel, the west bank and gaza": ["IL", "PS"],
  "west bank and gaza": ["PS"],
  micronesia: ["FM"],
  "federated states of micronesia": ["FM"],
  macau: ["MO"],
  laos: ["LA"],
  syria: ["SY"],
  moldova: ["MD"],
  brunei: ["BN"],
  "cabo verde": ["CV"],
  "holy see": ["VA"],
  "vatican city": ["VA"],
  "sint maarten": ["SX"],
  "bonaire, sint eustatius, and saba": ["BQ"],
  "british virgin islands": ["VG"],
  "falkland islands": ["FK"],
  "cote d ivoire": ["CI"],
  "kingdom of the netherlands": ["NL"],
};

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveUsName(rawName: string): string[] {
  const name = normaliseName(rawName);
  const lower = name.toLowerCase();

  if (US_NAME_ALIASES[lower]) return US_NAME_ALIASES[lower];

  const candidates = [
    name,
    name.replace(/^the /i, ""),
    name.replace(/^St\.? /i, "Saint "),
    name.replace(/\s*\(.*\)\s*$/, ""),
  ];

  for (const candidate of candidates) {
    const code = countries.getAlpha2Code(candidate, "en");
    if (code) return [code];
  }

  return [];
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`),
  );
  return match?.[1]?.trim() ?? "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseUnitedStates(xml: string): SourceResult {
  const advisories: AdvisoryMap = new Map();
  const unmatched: string[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const title = decodeEntities(extractTag(block, "title"));
    const levelMatch = title.match(/^(.*?)\s+-\s+(Level\s+([1-4])\s*:\s*.+)$/i);
    if (!levelMatch) continue;

    const [, rawName, label, levelText] = levelMatch;
    const severity = Number(levelText) as TravelSeverity;
    const url = extractTag(block, "link") || extractTag(block, "guid");
    const pubDate = extractTag(block, "pubDate");
    const parsedDate = pubDate ? new Date(pubDate) : null;
    const codes = resolveUsName(rawName);

    if (codes.length === 0) {
      unmatched.push(rawName);
      continue;
    }

    for (const iso2 of codes) {
      advisories.set(iso2, {
        severity,
        label: label.trim(),
        // The feed has no explicit flag for region-only levels.
        regional: false,
        url: url || undefined,
        updatedAt:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : undefined,
      });
    }
  }

  if (advisories.size === 0) {
    throw new Error("No advisories found in feed");
  }

  return { advisories, unmatched };
}

// ---------------------------------------------------------------------------
// Canada
// ---------------------------------------------------------------------------

const CA_LABELS: Record<number, string> = {
  0: "Take normal security precautions",
  1: "Exercise a high degree of caution",
  2: "Avoid non-essential travel",
  3: "Avoid all travel",
};

interface CaEntry {
  "country-iso"?: string;
  "advisory-state"?: number | string;
  "has-regional-advisory"?: number | string;
  "date-published"?: { timestamp?: number };
  eng?: { "advisory-text"?: string; "url-slug"?: string };
}

export function parseCanada(json: unknown): SourceResult {
  const data = (json as { data?: Record<string, CaEntry> })?.data;
  if (!data || typeof data !== "object") {
    throw new Error("Unexpected response shape");
  }

  const advisories: AdvisoryMap = new Map();

  for (const [key, entry] of Object.entries(data)) {
    const iso2 = (entry["country-iso"] ?? key).toUpperCase();
    const state = Number(entry["advisory-state"]);
    if (!Number.isInteger(state) || state < 0 || state > 3) continue;

    const slug = entry.eng?.["url-slug"];
    advisories.set(iso2, {
      severity: (state + 1) as TravelSeverity,
      label: entry.eng?.["advisory-text"] || CA_LABELS[state],
      regional: Number(entry["has-regional-advisory"]) === 1,
      url: slug ? `https://travel.gc.ca/destinations/${slug}` : undefined,
      updatedAt: unixToIso(entry["date-published"]?.timestamp),
    });
  }

  return { advisories };
}

// ---------------------------------------------------------------------------
// Combined
// ---------------------------------------------------------------------------

const LOADERS: Record<TravelSourceId, () => Promise<SourceResult>> = {
  de: async () => parseGermany(JSON.parse(await fetchText(DE_URL))),
  us: async () => parseUnitedStates(await fetchText(US_URL)),
  ca: async () => parseCanada(JSON.parse(await fetchText(CA_URL))),
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(iso2: string): string {
  try {
    return regionNames.of(iso2) ?? countries.getName(iso2, "en") ?? iso2;
  } catch {
    return countries.getName(iso2, "en") ?? iso2;
  }
}

export async function getTravelAdvisoryData(): Promise<TravelAdvisoryData> {
  const ids = Object.keys(LOADERS) as TravelSourceId[];
  const results = await Promise.allSettled(ids.map((id) => LOADERS[id]()));

  const byCountry = new Map<string, TravelCountry>();
  const sources: TravelSourceStatus[] = [];

  results.forEach((result, index) => {
    const id = ids[index];

    if (result.status === "rejected") {
      sources.push({
        id,
        name: SOURCE_NAMES[id],
        ok: false,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : "Fetch failed",
      });
      return;
    }

    const { advisories, unmatched } = result.value;
    sources.push({
      id,
      name: SOURCE_NAMES[id],
      ok: true,
      count: advisories.size,
      ...(unmatched?.length ? { unmatched } : {}),
    });

    for (const [iso2, advisory] of advisories) {
      let country = byCountry.get(iso2);
      if (!country) {
        country = {
          iso2,
          numeric: iso2 === "XK" ? null : (countries.alpha2ToNumeric(iso2) ?? null),
          name: countryName(iso2),
          advisories: {},
        };
        byCountry.set(iso2, country);
      }
      country.advisories[id] = advisory;
    }
  });

  if (sources.every((source) => !source.ok)) {
    throw new Error("All travel advisory sources are currently unavailable");
  }

  return {
    countries: [...byCountry.values()].sort((a, b) => a.name.localeCompare(b.name, "en")),
    sources,
    updatedAt: new Date().toISOString(),
  };
}
