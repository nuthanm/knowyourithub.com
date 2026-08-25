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
type QueueProfileStatus = "unverified" | "in_progress";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildQueueDraft(input: {
  slug: string;
  name: string;
  website?: string;
  status: QueueProfileStatus;
}): CompanyProfile {
  const website = input.website?.trim() || `https://${input.slug}.com`;
  return {
    slug: input.slug,
    name: input.name,
    category: "unknown",
    tagline: input.status === "in_progress" ? "Profile is under verification" : "Profile is awaiting review",
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
    verificationStatus: input.status,
  };
}

async function readCatalog(): Promise<CatalogFile | null> {
  try {
    const raw = await readFile(CATALOG_PATH, "utf8");
    const catalog = JSON.parse(raw) as CatalogFile;
    if (!Array.isArray(catalog.companies)) return null;
    // Do not accidentally overwrite the pre-migration catalog with queue records.
    if (catalog.companies.some((company) => company.verificationStatus === "verified")) return null;
    return catalog;
  } catch {
    return null;
  }
}

export async function readCatalogQueueDrafts() {
  const catalog = await readCatalog();
  if (!catalog) return [];
  return catalog.companies.filter(
    (company) => company.verificationStatus === "unverified" || company.verificationStatus === "in_progress",
  );
}

async function writeCatalog(catalog: CatalogFile) {
  await mkdir(dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export async function upsertCatalogQueueDraft(input: {
  slug: string;
  name: string;
  website?: string;
  status: QueueProfileStatus;
}) {
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
      verificationStatus: input.status,
      lastVerified: now,
    };
    catalog.companies[index] = next;
  } else {
    catalog.companies.push(buildQueueDraft(input));
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
