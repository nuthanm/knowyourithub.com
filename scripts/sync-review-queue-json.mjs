import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting queue sync.");
  process.exit(1);
}

const queuePath = resolve(process.cwd(), "data", "companies.json");

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildQueueProfile(row) {
  const slug = row.company_slug?.trim() || slugify(row.company_name);
  if (!slug) throw new Error(`Submission ${row.id} has no usable company slug.`);

  const website = row.website?.trim() || `https://${slug}.com`;
  const inProgress = row.status === "in_progress";
  return {
    slug,
    name: row.company_name.trim(),
    category: "unknown",
    tagline: inProgress ? "Profile is under verification" : "Profile is awaiting review",
    description: "This company profile is being reviewed before it is published as verified.",
    website,
    hq: "Unknown",
    domains: ["Unknown"],
    tags: ["Community request"],
    services: ["Under review"],
    sources: [{ label: "Community submission", url: website }],
    lastVerified: new Date().toISOString().slice(0, 10),
    verificationStatus: inProgress ? "in_progress" : "unverified",
  };
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const rows = await sql`
    SELECT id, company_name, company_slug, website, status
    FROM company_submissions
    WHERE status IN ('awaiting_review', 'in_progress')
    ORDER BY created_at DESC
  `;
  const queue = {
    dataYear: new Date().getUTCFullYear(),
    catalogUpdated: new Date().toISOString().slice(0, 10),
    disclaimer: "Active community submissions awaiting review or in progress.",
    companies: rows.map(buildQueueProfile),
  };

  await mkdir(dirname(queuePath), { recursive: true });
  await writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  console.log(`Wrote ${queue.companies.length} active review records to ${queuePath}.`);
} finally {
  await sql.end({ timeout: 5 });
}