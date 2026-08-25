import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.log("DATABASE_URL is missing or placeholder. Skipping migration.");
  process.exit(0);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProfile(row, existingPayload) {
  const slug = row.company_slug?.trim() || slugify(row.company_name);
  if (!slug) throw new Error(`Verified submission ${row.id} has no usable company slug.`);

  const existing = existingPayload && typeof existingPayload === "object" ? existingPayload : {};
  const website = row.website?.trim() || existing.website || `https://${slug}.com`;
  const lastVerified = new Date().toISOString().slice(0, 10);

  return {
    ...existing,
    slug,
    name: row.company_name.trim() || existing.name || slug,
    category: existing.category || "unknown",
    tagline: existing.tagline || "Profile verified from a community submission",
    description:
      existing.description ||
      "This company profile was verified after community review. Details will be expanded from official sources.",
    website,
    hq: existing.hq || "Unknown",
    domains: Array.isArray(existing.domains) && existing.domains.length ? existing.domains : ["Unknown"],
    tags: Array.isArray(existing.tags) && existing.tags.length ? existing.tags : ["Community verified"],
    sources: Array.isArray(existing.sources) && existing.sources.length
      ? existing.sources
      : [{ label: "Community submission", url: website }],
    lastVerified,
    verificationStatus: "verified",
  };
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const migrated = await sql.begin(async (tx) => {
    const rows = await tx`
      SELECT id, company_name, company_slug, website
      FROM company_submissions
      WHERE status = 'verified'
      ORDER BY created_at ASC
      FOR UPDATE
    `;

    for (const row of rows) {
      const slug = row.company_slug?.trim() || slugify(row.company_name);
      if (!slug) throw new Error(`Verified submission ${row.id} has no usable company slug.`);

      const existingRows = await tx`
        SELECT payload
        FROM company_profiles
        WHERE slug = ${slug}
        FOR UPDATE
      `;
      const profile = buildProfile(row, existingRows[0]?.payload);

      await tx`
        INSERT INTO company_profiles (slug, name, category, verification_status, last_verified, payload, updated_at)
        VALUES (${profile.slug}, ${profile.name}, ${profile.category}, 'verified', ${profile.lastVerified}, ${tx.json(profile)}, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          verification_status = 'verified',
          last_verified = EXCLUDED.last_verified,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `;

      await tx`DELETE FROM company_submissions WHERE id = ${row.id} AND status = 'verified'`;
    }

    return rows.length;
  });

  console.log(`Migrated and removed ${migrated} verified submission row(s).`);
} finally {
  await sql.end({ timeout: 5 });
}