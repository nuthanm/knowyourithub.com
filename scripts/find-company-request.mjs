import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const companyName = process.argv.slice(2).join(" ").trim();
if (!companyName) {
  console.error('Usage: node scripts/find-company-request.mjs "Company Name"');
  process.exit(1);
}

const slug = companyName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting lookup.");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const [submissions, profiles] = await Promise.all([
    sql`
      SELECT id, company_name, company_slug, status, request_type, created_at, updated_at
      FROM company_submissions
      WHERE LOWER(company_slug) = LOWER(${slug}) OR LOWER(company_name) = LOWER(${companyName})
      ORDER BY created_at DESC
    `,
    sql`
      SELECT slug, name, verification_status, last_verified, updated_at, payload
      FROM company_profiles
      WHERE LOWER(slug) = LOWER(${slug}) OR LOWER(name) = LOWER(${companyName})
      ORDER BY updated_at DESC
    `,
  ]);
  console.log(JSON.stringify({ companyName, slug, submissions, profiles }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}