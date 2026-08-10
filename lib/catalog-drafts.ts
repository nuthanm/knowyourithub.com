import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CompanyProfile } from "@/lib/companies";

type CatalogFile = {
  dataYear: number;
  catalogUpdated: string;
  disclaimer: string;
  companies: CompanyProfile[];
};

const CATALOG_PATH = resolve(process.cwd(), "data", "companies.json");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildInProgressDraft(input: { slug: string; name: string; website?: string }): CompanyProfile {
  const website = input.website?.trim() || `https://${input.slug}.com`;
  return {
    slug: input.slug,
    name: input.name,
    category: "unknown",
    tagline: "Profile is under verification",
    description:
      "This company profile is currently in progress. We validate details against official sources before marking it verified.",
    website,
    hq: "Unknown",
    domains: ["Unknown"],
    tags: ["Community request"],
    services: ["Under review"],
    sources: [
      {
        label: "Community submission",
        url: website,
      },
    ],
    lastVerified: todayIso(),
    verificationStatus: "in_progress",
  };
}

async function readCatalog(): Promise<CatalogFile | null> {
  try {
    const raw = await readFile(CATALOG_PATH, "utf8");
    return JSON.parse(raw) as CatalogFile;
  } catch {
    return null;
  }
}

async function writeCatalog(catalog: CatalogFile) {
  await mkdir(dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export async function upsertInProgressCatalogDraft(input: { slug: string; name: string; website?: string }) {
  const catalog = await readCatalog();
  if (!catalog) return { updated: false as const };

  const index = catalog.companies.findIndex((company) => company.slug === input.slug);
  const now = todayIso();

  if (index >= 0) {
    const existing = catalog.companies[index];
    const next: CompanyProfile = {
      ...existing,
      name: input.name || existing.name,
      website: input.website?.trim() || existing.website,
      verificationStatus: "in_progress",
      lastVerified: now,
    };
    catalog.companies[index] = next;
  } else {
    catalog.companies.push(buildInProgressDraft(input));
  }

  catalog.catalogUpdated = now;
  await writeCatalog(catalog);
  return { updated: true as const };
}

export async function removeCatalogDraftBySlug(slug: string) {
  const normalized = slug.trim();
  if (!normalized) return { updated: false as const, removed: false as const };

  const catalog = await readCatalog();
  if (!catalog) return { updated: false as const, removed: false as const };

  const index = catalog.companies.findIndex((company) => company.slug === normalized);
  if (index < 0) return { updated: true as const, removed: false as const };

  const target = catalog.companies[index];
  if (target.verificationStatus === "verified") {
    return { updated: true as const, removed: false as const };
  }

  catalog.companies.splice(index, 1);
  catalog.catalogUpdated = todayIso();
  await writeCatalog(catalog);
  return { updated: true as const, removed: true as const };
}
