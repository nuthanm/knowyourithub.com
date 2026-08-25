import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting push.");
  process.exit(1);
}

const root = process.cwd();
const generatedCatalogPath = resolve(root, "data", "catalog.generated.json");
const legacyCatalogPath = resolve(root, "data", "companies.json");

function assertCatalogShape(value) {
  if (!value || typeof value !== "object") throw new Error("Catalog payload must be an object.");
  if (!Array.isArray(value.companies)) throw new Error("Catalog payload requires companies[] array.");
  if (typeof value.dataYear !== "string" && typeof value.dataYear !== "number") {
    throw new Error("Catalog payload requires dataYear.");
  }
}

const catalogPath = await access(generatedCatalogPath)
  .then(() => generatedCatalogPath)
  .catch(() => legacyCatalogPath);
const raw = await readFile(catalogPath, "utf8");
const payload = JSON.parse(raw);
assertCatalogShape(payload);
const profiles = payload.companies.map((company) => {
  if (!company?.slug) throw new Error("Every company requires a slug.");
  return {
    slug: company.slug,
    name: company.name || company.slug,
    category: company.category || "unknown",
    verification_status: company.verificationStatus || "unverified",
    last_verified: company.lastVerified || null,
    payload: company,
  };
});

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  await sql`SELECT pg_advisory_lock(hashtext('knowyourcompanytype:catalog-schema'))`;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS company_profiles (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        last_verified TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS company_catalog_metadata (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        data_year INTEGER NOT NULL,
        catalog_updated TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext('knowyourcompanytype:catalog-schema'))`;
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO company_catalog_metadata (id, data_year, catalog_updated, disclaimer, updated_at)
      VALUES (TRUE, ${Number(payload.dataYear)}, ${payload.catalogUpdated || ""}, ${payload.disclaimer || ""}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data_year = EXCLUDED.data_year,
        catalog_updated = EXCLUDED.catalog_updated,
        disclaimer = EXCLUDED.disclaimer,
        updated_at = NOW()
    `;

    await tx`
      INSERT INTO company_profiles (slug, name, category, verification_status, last_verified, payload, updated_at)
      SELECT slug, name, category, verification_status, last_verified, payload, NOW()
      FROM jsonb_to_recordset(${tx.json(profiles)}::jsonb) AS incoming(
        slug TEXT,
        name TEXT,
        category TEXT,
        verification_status TEXT,
        last_verified TEXT,
        payload JSONB
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        verification_status = EXCLUDED.verification_status,
        last_verified = EXCLUDED.last_verified,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  });

  console.log(`Catalog push complete. Upserted ${payload.companies.length} company rows.`);
} finally {
  await sql.end({ timeout: 5 });
}
