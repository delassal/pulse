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
// United Kingdom: FCDO travel advice via the GOV.UK Content API. The index lists the
// country pages; the alert status is only on each page, so every page is fetched.
const UK_INDEX_URL = "https://www.gov.uk/api/content/foreign-travel-advice";
const UK_CONCURRENCY = 8;

const USER_AGENT =
  "Mozilla/5.0 (compatible; Pulse/1.0; personal dashboard; +https://danielelassal.com)";
const TIMEOUT_MS = 15_000;

const SOURCE_NAMES: Record<TravelSourceId, string> = {
  de: "Germany (Auswärtiges Amt)",
  us: "United States (State Department)",
  ca: "Canada (Global Affairs)",
  uk: "United Kingdom (FCDO)",
};

type AdvisoryMap = Map<string, TravelAdvisory>;

interface SourceResult {
  advisories: AdvisoryMap;
  unmatched?: string[];
  /** Source-provided names for codes the ISO tables don't know (e.g. Canada's "PT-20" = Azores). */
  names?: Map<string, string>;
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
// Country name matching (US and UK publish names, not ISO codes)
// ---------------------------------------------------------------------------

// Names in the US and UK feeds that do not resolve through the ISO name table.
const NAME_ALIASES: Record<string, string[]> = {
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
  "kingdom of denmark": ["DK"],
  "kyrgyz republic": ["KG"],
  "republic of congo": ["CG"],
  "west bank": ["PS"],
  gaza: ["PS"],
  curacao: ["CW"],
  "saint barthelemy": ["BL"],
  bonaire: ["BQ"],
  "saba and sint eustatius": ["BQ"],
  "french saint martin": ["MF"],
  // Martinique, St. Barthélemy and St. Martin have their own entries.
  "french west indies": ["GP"],
  // UK
  "pitcairn island": ["PN"],
  "bonaire/st eustatius/saba": ["BQ"],
  "st maarten": ["SX"],
  "st martin and st barthelemy": ["MF", "BL"],
  "st helena, ascension and tristan da cunha": ["SH"],
  "cook islands, tokelau and niue": ["CK", "TK", "NU"],
  "antarctica/british antarctic territory": ["AQ"],
  reunion: ["RE"],
  "sao tome and principe": ["ST"],
};

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCountryName(rawName: string): string[] {
  const name = normaliseName(rawName)
    .replace(/\s+Travel Advisory$/i, "")
    .replace(/^the /i, "");
  const lower = name.toLowerCase();

  if (NAME_ALIASES[lower]) return NAME_ALIASES[lower];

  const candidates = [
    name,
    name.replace(/^St\.? /i, "Saint ").replace(/ & /g, " and "),
    name.replace(/\s*\(.*\)\s*$/, ""),
  ];

  for (const candidate of candidates) {
    const code = countries.getAlpha2Code(candidate, "en");
    if (code) return [code];
  }

  return [];
}

// ---------------------------------------------------------------------------
// United States
// ---------------------------------------------------------------------------

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
    const codes = resolveCountryName(rawName);

    if (codes.length === 0) {
      unmatched.push(rawName);
      continue;
    }

    for (const iso2 of codes) {
      // Several feed entries can map to one country (West Bank + Gaza, Bonaire + Saba):
      // keep the strictest level and flag it as regional when the levels differ.
      const existing = advisories.get(iso2);
      if (existing && existing.severity >= severity) {
        existing.regional ||= existing.severity !== severity;
        continue;
      }

      advisories.set(iso2, {
        severity,
        // Some titles repeat the level ("Level 3: Reconsider Travel - Level 3: Reconsider Travel").
        label: label.split(/\s+-\s+/)[0].trim(),
        // The feed has no explicit flag for region-only levels.
        regional: Boolean(existing),
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
  "country-eng"?: string;
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
  const names = new Map<string, string>();

  for (const [key, entry] of Object.entries(data)) {
    const iso2 = (entry["country-iso"] ?? key).toUpperCase();
    const state = Number(entry["advisory-state"]);
    if (!Number.isInteger(state) || state < 0 || state > 3) continue;

    const name = entry["country-eng"]?.trim();
    if (name) names.set(iso2, name);

    const slug = entry.eng?.["url-slug"];
    advisories.set(iso2, {
      severity: (state + 1) as TravelSeverity,
      label: entry.eng?.["advisory-text"] || CA_LABELS[state],
      regional: Number(entry["has-regional-advisory"]) === 1,
      url: slug ? `https://travel.gc.ca/destinations/${slug}` : undefined,
      updatedAt: unixToIso(entry["date-published"]?.timestamp),
    });
  }

  return { advisories, names };
}

// ---------------------------------------------------------------------------
// United Kingdom
// ---------------------------------------------------------------------------

// FCDO alert statuses mapped onto the shared scale. The UK has no "increased caution"
// tier, so a region-only "all but essential" advisory takes level 2.
const UK_ALERTS: Record<string, { severity: TravelSeverity; label: string; regional: boolean }> = {
  avoid_all_travel_to_whole_country: {
    severity: 4,
    label: "Advise against all travel",
    regional: false,
  },
  avoid_all_travel_to_parts: {
    severity: 3,
    label: "Advise against all travel to parts",
    regional: true,
  },
  avoid_all_but_essential_travel_to_whole_country: {
    severity: 3,
    label: "Advise against all but essential travel",
    regional: false,
  },
  avoid_all_but_essential_travel_to_parts: {
    severity: 2,
    label: "Advise against all but essential travel to parts",
    regional: true,
  },
};

interface UkIndexChild {
  api_url?: string;
  web_url?: string;
  withdrawn?: boolean;
  details?: { country?: { name?: string } };
}

interface UkCountryPage {
  web_url?: string;
  public_updated_at?: string;
  details?: { alert_status?: string[]; country?: { name?: string } };
}

export function parseUnitedKingdomPage(json: unknown): TravelAdvisory {
  const page = json as UkCountryPage;
  const alerts = (page.details?.alert_status ?? [])
    .map((status) => UK_ALERTS[status])
    .filter(Boolean)
    // Strictest first; on a tie the whole-country advisory wins over the regional one.
    .sort((a, b) => b.severity - a.severity || Number(a.regional) - Number(b.regional));

  const updated = page.public_updated_at ? new Date(page.public_updated_at) : null;

  return {
    severity: alerts[0]?.severity ?? 1,
    label: alerts.length
      ? alerts.map((alert) => alert.label).join("; ")
      : "No advice against travel",
    regional: alerts[0]?.regional ?? false,
    url: page.web_url,
    updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : undefined,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function loadUnitedKingdom(): Promise<SourceResult> {
  const index = JSON.parse(await fetchText(UK_INDEX_URL)) as {
    links?: { children?: UkIndexChild[] };
  };
  const children = (index.links?.children ?? []).filter(
    (child) => child.api_url && child.details?.country?.name && !child.withdrawn,
  );
  if (children.length === 0) {
    throw new Error("No countries found in index");
  }

  const pages = await mapWithConcurrency(children, UK_CONCURRENCY, async (child) =>
    parseUnitedKingdomPage(JSON.parse(await fetchText(child.api_url!))),
  );

  // A few failed pages leave gaps on the map; many failures mean the source is down.
  const failed = pages.filter((page) => page.status === "rejected").length;
  if (failed > children.length * 0.1) {
    throw new Error(`${failed} of ${children.length} country pages failed`);
  }

  const advisories: AdvisoryMap = new Map();
  const unmatched: string[] = [];

  children.forEach((child, i) => {
    const page = pages[i];
    if (page.status !== "fulfilled") return;

    const name = child.details!.country!.name!;
    const codes = resolveCountryName(name);
    if (codes.length === 0) {
      unmatched.push(name);
      return;
    }
    for (const iso2 of codes) advisories.set(iso2, page.value);
  });

  return { advisories, unmatched };
}

// ---------------------------------------------------------------------------
// Combined
// ---------------------------------------------------------------------------

const LOADERS: Record<TravelSourceId, () => Promise<SourceResult>> = {
  de: async () => parseGermany(JSON.parse(await fetchText(DE_URL))),
  us: async () => parseUnitedStates(await fetchText(US_URL)),
  ca: async () => parseCanada(JSON.parse(await fetchText(CA_URL))),
  uk: loadUnitedKingdom,
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(iso2: string, fallback?: string): string {
  try {
    return regionNames.of(iso2) ?? countries.getName(iso2, "en") ?? fallback ?? iso2;
  } catch {
    // Intl.DisplayNames throws on subdivision codes such as "PT-20".
    return countries.getName(iso2, "en") ?? fallback ?? iso2;
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

    const { advisories, unmatched, names } = result.value;
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
          name: countryName(iso2, names?.get(iso2)),
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
