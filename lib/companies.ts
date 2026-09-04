import pendingCatalog from "@/data/companies.json";
import {
  companyProfileToEntry,
  filterCompanies,
  filterCompanyEntries,
  type CompanySearchEntry,
} from "./company-search";

export type CompanyCategory = "product" | "service" | "hybrid" | "unknown";
export type VerificationStatus = "verified" | "in_progress" | "unverified";

export type DataSource = {
  label: string;
  url: string;
};

export type CompanyProfile = {
  slug: string;
  name: string;
  category: CompanyCategory;
  tagline: string;
  description: string;
  website: string;
  founded?: string;
  hq: string;
  /** Major hiring cities — curated preview, not exhaustive */
  officeCities?: string[];
  /** Countries with significant presence — when verified from official sources */
  officeCountries?: string[];
  /** Official total only when cited (e.g. "55 countries", "100+ India offices") */
  totalOfficeLocations?: string;
  /** Official page listing offices / worldwide presence */
  locationsUrl?: string;
  /** Contact page when no dedicated locations list or verified total */
  contactUrl?: string;
  /** Override auto-generated Google Maps search link for HQ */
  hqMapUrl?: string;
  headcountIndia?: string;
  headcountGlobal?: string;
  headcountNote?: string;
  domains: string[];
  tags: string[];
  products?: string[];
  services?: string[];
  clients?: string[];
  onsitePolicy?: string;
  careersUrl?: string;
  linkedin?: string;
  twitter?: string;
  interviewPatterns?: string[];
  interviewPatternsNote?: string;
  leadership?: { name: string; role: string }[];
  vision?: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
  sources: DataSource[];
};

export type LeadershipEntry = NonNullable<CompanyProfile["leadership"]>[number];

/** Sort leadership: main founder first, then co-founders, CEO, COO, CTO, others. */
export function sortLeadership(leadership: LeadershipEntry[]) {
  const priority = (role: string) => {
    const lower = role.toLowerCase();
    if (lower.includes("founder") && !lower.includes("co-founder")) return 0;
    if (lower.includes("co-founder")) return 1;
    if (lower.includes("ceo")) return 2;
    if (lower.includes("coo")) return 3;
    if (lower.includes("cto")) return 4;
    return 5;
  };

  return [...leadership].sort((a, b) => priority(a.role) - priority(b.role));
}

export function isMainFounder(role: string) {
  const lower = role.toLowerCase();
  return lower.includes("founder") && !lower.includes("co-founder");
}

/** Cities shown before pointing visitors to the official list. */
export const OFFICE_CITY_PREVIEW_LIMIT = 6;

/** Normalize URLs for duplicate detection (hostname + path, no trailing slash). */
export function normalizeProfileUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname}${pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, "");
  }
}

/** Quick-link destinations — excluded from the Sources sidebar to avoid duplicates. */
export function getProfileQuickLinkUrls(company: CompanyProfile) {
  const urls = [company.website, company.careersUrl, company.linkedin, company.twitter].filter(
    Boolean,
  ) as string[];

  return new Set(urls.map(normalizeProfileUrl));
}

/** Google Maps search link for HQ — link-out only, no embed. */
export function getHqMapUrl(company: CompanyProfile) {
  if (company.hqMapUrl) return company.hqMapUrl;

  const primaryHq = company.hq.split("/")[0]?.trim() ?? company.hq;
  const query = `${company.name} headquarters ${primaryHq}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getOfficeCityPreview(company: CompanyProfile) {
  const cities = company.officeCities ?? [];
  const preview = cities.slice(0, OFFICE_CITY_PREVIEW_LIMIT);
  const remaining = Math.max(0, cities.length - preview.length);
  return { preview, remaining };
}

export type OfficialPresenceLink = {
  url: string;
  label: string;
};

/** Official locations or contact page — skips URLs already in Quick links. */
export function getOfficialPresenceLink(company: CompanyProfile): OfficialPresenceLink | undefined {
  const blocked = getProfileQuickLinkUrls(company);

  if (company.locationsUrl) {
    const url = company.locationsUrl;
    if (!blocked.has(normalizeProfileUrl(url))) {
      return {
        url,
        label: company.totalOfficeLocations
          ? `All offices (${company.totalOfficeLocations})`
          : "Office locations",
      };
    }
  }

  if (company.contactUrl) {
    const url = company.contactUrl;
    if (!blocked.has(normalizeProfileUrl(url))) {
      return { url, label: "Contact & locations" };
    }
  }

  return undefined;
}

/** Hide the Locations block when it would repeat HQ or add little value. */
export function shouldShowLocationsSection(company: CompanyProfile) {
  const { preview } = getOfficeCityPreview(company);
  const presenceLink = getOfficialPresenceLink(company);

  if ((company.officeCountries?.length ?? 0) > 0) return true;
  if (company.totalOfficeLocations && presenceLink) return true;
  if (preview.length > 1) return true;
  if (preview.length > 0 && presenceLink) return true;

  return false;
}

/** Provenance links only — omits URLs already shown under Quick links or Locations. */
export function getCitationSources(company: CompanyProfile) {
  const excluded = getProfileQuickLinkUrls(company);

  for (const url of [company.locationsUrl, company.contactUrl]) {
    if (url) excluded.add(normalizeProfileUrl(url));
  }

  return company.sources.filter((source) => !excluded.has(normalizeProfileUrl(source.url)));
}

export function companyMatchesLocation(
  company: Pick<CompanyProfile, "hq" | "officeCities" | "officeCountries">,
  location: string,
) {
  const loc = location.trim().toLowerCase();
  if (!loc || loc === "all") return true;

  if (company.hq.toLowerCase().includes(loc)) return true;

  if ((company.officeCities ?? []).some((city) => city.toLowerCase().includes(loc))) return true;

  return (company.officeCountries ?? []).some((country) => country.toLowerCase().includes(loc));
}

export const CATEGORY_LABELS: Record<CompanyCategory, string> = {
  product: "Product-based",
  service: "Service-based",
  hybrid: "Hybrid",
  unknown: "",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  in_progress: "In progress",
  unverified: "Awaiting review",
};

export const DATA_YEAR = pendingCatalog.dataYear;
export const CATALOG_UPDATED = pendingCatalog.catalogUpdated;
export const CATALOG_DISCLAIMER = pendingCatalog.disclaimer;

const catalogCompanies: CompanyProfile[] = [];
const catalogSlugs = new Set(catalogCompanies.map((company) => company.slug));
const pendingCompanies = (pendingCatalog.companies as CompanyProfile[]).filter(
  (company) => !catalogSlugs.has(company.slug),
);

export const COMPANIES: CompanyProfile[] = [...catalogCompanies, ...pendingCompanies];

function countByCategory(list: CompanyProfile[]) {
  const counts = { product: 0, service: 0, hybrid: 0, unknown: 0, total: 0 };
  for (const c of list) {
    counts[c.category] += 1;
    counts.total += 1;
  }
  return counts;
}

export const VERIFIED_COMPANIES = COMPANIES.filter((c) => c.verificationStatus === "verified");

export const ALL_SEARCH_ENTRIES: CompanySearchEntry[] = COMPANIES.map(companyProfileToEntry);

export const ALL_COMPANY_SLUGS = ALL_SEARCH_ENTRIES.map((e) => e.slug);

export const CATEGORY_COUNTS = countByCategory(VERIFIED_COMPANIES);

export const CATALOG_PROGRESS = {
  verified: VERIFIED_COMPANIES.length,
  inProgress: COMPANIES.filter((company) => company.verificationStatus === "in_progress").length,
  unverified: COMPANIES.filter((company) => company.verificationStatus === "unverified").length,
  totalTracked: COMPANIES.length,
};

export function getCompanyBySlug(slug: string) {
  const company = COMPANIES.find((c) => c.slug === slug);
  if (!company || company.verificationStatus !== "verified") return undefined;
  return company;
}

export function getCompanyEntryBySlug(slug: string): CompanySearchEntry | undefined {
  return ALL_SEARCH_ENTRIES.find((e) => e.slug === slug);
}

export function searchCompanies(
  query: string,
  category?: CompanyCategory | "all",
  location?: string,
) {
  return filterCompanies(VERIFIED_COMPANIES, { query, category, location });
}

export function searchAllCompanies(
  query: string,
  category?: CompanyCategory | "all",
  location?: string,
) {
  return filterCompanyEntries(ALL_SEARCH_ENTRIES, { query, category, location });
}

export function slugifyCompanyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
