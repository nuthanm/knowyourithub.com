import {
  companyMatchesLocation,
  type CompanyCategory,
  type CompanyProfile,
  type VerificationStatus,
} from "./companies";

export type CompanySearchFilters = {
  query?: string;
  location?: string;
  category?: CompanyCategory | "all";
  domain?: string;
  status?: VerificationStatus | "all" | "pipeline";
};

const PREFERRED_DOMAIN_ORDER = [
  "IT Services",
  "SaaS",
  "Fintech",
  "Insurance",
  "Healthcare",
  "E-commerce",
  "Cloud",
  "AI/ML",
  "Consulting",
  "Chemicals",
  "Manufacturing",
  "Banking",
] as const;

const PREFERRED_DOMAIN_INDEX = new Map<string, number>(
  PREFERRED_DOMAIN_ORDER.map((label, index) => [label.toLowerCase(), index]),
);

/** Unified row for directory search — verified profiles and pipeline queue items */
export type CompanySearchEntry = {
  slug: string;
  name: string;
  verificationStatus: VerificationStatus;
  category: CompanyCategory;
  tagline?: string;
  hq?: string;
  domains?: string[];
  tags?: string[];
  note?: string;
  /** Full profile when verified */
  profile?: CompanyProfile;
  /** Portal submission not yet represented by a full company profile */
  communityRequest?: boolean;
  submissionId?: string;
};

export function companyProfileToEntry(company: CompanyProfile): CompanySearchEntry {
  return {
    slug: company.slug,
    name: company.name,
    verificationStatus: company.verificationStatus,
    category: company.category,
    tagline: company.tagline,
    hq: company.hq,
    domains: company.domains,
    tags: company.tags,
    profile: company,
  };
}

/** Unique location labels for filters — prefers full HQ over bare city duplicates. */
export function getCompanyLocations(companies: CompanyProfile[]) {
  const set = new Set<string>();
  for (const c of companies) {
    const hq = c.hq.trim();
    if (hq) set.add(hq);
    for (const officeCity of c.officeCities ?? []) {
      const trimmed = officeCity.trim();
      if (trimmed) set.add(trimmed);
    }
  }

  const all = Array.from(set);
  // Drop "Akron" when "Akron, United States" exists; keep distinct regions (e.g. Arlington TX vs VA).
  const deduped = all.filter((loc) => {
    const lower = loc.toLowerCase();
    return !all.some((other) => {
      if (other === loc) return false;
      const o = other.toLowerCase();
      return o.startsWith(`${lower},`) || o.startsWith(`${lower} /`);
    });
  });

  return deduped.sort((a, b) => a.localeCompare(b));
}

/** Unique domain labels for industry-style filtering (e.g. IT Services, Insurance). */
export function getCompanyDomains(companies: CompanyProfile[]) {
  const map = new Map<string, string>();

  for (const company of companies) {
    for (const domain of company.domains ?? []) {
      const trimmed = domain.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) map.set(key, trimmed);
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => {
      const aPreferred = PREFERRED_DOMAIN_INDEX.get(a[0]);
      const bPreferred = PREFERRED_DOMAIN_INDEX.get(b[0]);

      if (aPreferred !== undefined && bPreferred !== undefined) {
        return aPreferred - bPreferred;
      }

      if (aPreferred !== undefined) return -1;
      if (bPreferred !== undefined) return 1;

      return a[1].localeCompare(b[1]);
    })
    .map(([value, label]) => ({
      value,
      label,
      preferred: PREFERRED_DOMAIN_INDEX.has(value),
    }));
}

/** Match company identity fields only — not HQ/tags/description (avoids “Del” → Delhi). */
function companyMatchesQuery(
  query: string,
  fields: { name: string; slug?: string; domains?: string[] },
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = fields.name.toLowerCase();
  const slug = (fields.slug ?? "").toLowerCase();
  if (name.includes(q) || slug.includes(q)) return true;

  return (fields.domains ?? []).some((domain) => domain.toLowerCase().includes(q));
}

function queryMatchRank(
  query: string,
  fields: { name: string; slug?: string; domains?: string[] },
) {
  const q = query.trim().toLowerCase();
  const name = fields.name.toLowerCase();
  const slug = (fields.slug ?? "").toLowerCase();

  if (name.startsWith(q)) return 0;
  if (name.split(/[\s\-_/]+/).some((part) => part.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  if (slug.startsWith(q) || slug.includes(q)) return 3;
  if ((fields.domains ?? []).some((domain) => domain.toLowerCase().includes(q))) return 4;
  return 5;
}

export function filterCompanies(companies: CompanyProfile[], filters: CompanySearchFilters) {
  const q = filters.query?.trim() ?? "";
  const loc = filters.location?.trim().toLowerCase() ?? "";
  const category = filters.category ?? "all";
  const domain = filters.domain?.trim().toLowerCase() ?? "";

  const matched = companies.filter((c) => {
    if (category !== "all" && c.category !== category) return false;

    if (loc && loc !== "all" && !companyMatchesLocation(c, loc)) return false;

    if (domain && domain !== "all") {
      const hasDomain = (c.domains ?? []).some((d) => d.trim().toLowerCase() === domain);
      if (!hasDomain) return false;
    }

    return companyMatchesQuery(q, { name: c.name, slug: c.slug, domains: c.domains });
  });

  if (!q.trim()) return matched;

  return matched.sort((a, b) => {
    const rankDiff =
      queryMatchRank(q, { name: a.name, slug: a.slug, domains: a.domains }) -
      queryMatchRank(q, { name: b.name, slug: b.slug, domains: b.domains });
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

export function filterCompanyEntries(entries: CompanySearchEntry[], filters: CompanySearchFilters) {
  const q = filters.query?.trim() ?? "";
  const loc = filters.location?.trim().toLowerCase() ?? "";
  const category = filters.category ?? "all";
  const domain = filters.domain?.trim().toLowerCase() ?? "";
  const status = filters.status ?? "all";

  const matched = entries.filter((entry) => {
    if (status === "pipeline" && entry.verificationStatus === "verified") return false;
    if (
      status !== "all" &&
      status !== "pipeline" &&
      entry.verificationStatus !== status
    ) {
      return false;
    }

    if (category !== "all" && entry.category !== category) return false;

    if (domain && domain !== "all") {
      const hasDomain = (entry.profile?.domains ?? entry.domains ?? []).some(
        (d) => d.trim().toLowerCase() === domain,
      );
      if (!hasDomain) return false;
    }

    if (loc && loc !== "all") {
      const matchesHq = (entry.hq ?? "").toLowerCase().includes(loc);
      const matchesOffices = (entry.profile?.officeCities ?? []).some((city) =>
        city.toLowerCase().includes(loc),
      );
      const matchesCountries = (entry.profile?.officeCountries ?? []).some((country) =>
        country.toLowerCase().includes(loc),
      );
      if (!matchesHq && !matchesOffices && !matchesCountries) return false;
    }

    return companyMatchesQuery(q, {
      name: entry.name,
      slug: entry.slug,
      domains: entry.domains,
    });
  });

  if (!q.trim()) return matched;

  return matched.sort((a, b) => {
    const rankDiff =
      queryMatchRank(q, { name: a.name, slug: a.slug, domains: a.domains }) -
      queryMatchRank(q, { name: b.name, slug: b.slug, domains: b.domains });
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}
