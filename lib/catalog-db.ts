import "server-only";
import { cache } from "react";
import postgres from "postgres";
import { loadServerEnv } from "./server-env";
import type { CompanyProfile } from "./companies";

type CatalogMetadata = {
  dataYear: string | number;
  catalogUpdated: string;
  disclaimer: string;
};

const DEFAULT_METADATA: CatalogMetadata = {
  dataYear: new Date().getUTCFullYear(),
  catalogUpdated: new Date().toISOString().slice(0, 10),
  disclaimer: "Company profiles are maintained and verified by Know Your IT Hub.",
};

let sql: ReturnType<typeof postgres> | null = null;

function getSql() {
  loadServerEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("replace") || url.includes("user:password")) return null;
  if (!sql) sql = postgres(url, { max: 1, prepare: false });
  return sql;
}

export const getCatalogMetadata = cache(async (): Promise<CatalogMetadata> => {
  const db = getSql();
  if (!db) return DEFAULT_METADATA;

  try {
    const rows = await db`
      SELECT data_year, catalog_updated, disclaimer
      FROM company_catalog_metadata
      WHERE id = TRUE
      LIMIT 1
    `;
    const metadata = rows[0];
    return {
      dataYear: metadata?.data_year ?? DEFAULT_METADATA.dataYear,
      catalogUpdated: metadata?.catalog_updated ?? DEFAULT_METADATA.catalogUpdated,
      disclaimer: metadata?.disclaimer ?? DEFAULT_METADATA.disclaimer,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42P01") {
      return DEFAULT_METADATA;
    }
    throw error;
  }
});

export const getCatalogCompanies = cache(async (): Promise<CompanyProfile[]> => {
  const db = getSql();
  if (!db) return [];

  try {
    const rows = await db`
      SELECT payload
      FROM company_profiles
      ORDER BY name ASC, slug ASC
    `;
    return rows.map((row) => row.payload as CompanyProfile);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42P01") {
      return [];
    }
    throw error;
  }
});

export const getCatalogCompanyBySlug = cache(async (slug: string): Promise<CompanyProfile | undefined> => {
  const db = getSql();
  if (!db) return undefined;

  try {
    const rows = await db`
      SELECT payload
      FROM company_profiles
      WHERE slug = ${slug}
        AND verification_status = 'verified'
      LIMIT 1
    `;
    return rows[0]?.payload as CompanyProfile | undefined;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42P01") {
      return undefined;
    }
    throw error;
  }
});