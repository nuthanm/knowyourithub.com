import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.log("DATABASE_URL is missing or placeholder. Skipping queue sync.");
  process.exit(0);
}

const queuePath = resolve(process.cwd(), "data", "companies.json");
const generatedCatalogPath = resolve(process.cwd(), "data", "catalog.generated.json");

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function websiteHostKey(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    return normalizeKey(new URL(raw).hostname.replace(/^www\./, ""));
  } catch {
    return "";
  }
}

function submissionAliasKeys(row) {
  const keys = new Set();
  const slug = row.company_slug?.trim() || slugify(row.company_name);
  const slugKey = normalizeKey(slug);
  const nameKey = normalizeKey(row.company_name);
  const hostKey = websiteHostKey(row.website);
  if (slugKey) keys.add(slugKey);
  if (nameKey) keys.add(nameKey);
  if (hostKey) keys.add(hostKey);
  return keys;
}

function profileAliasKeys(row) {
  const keys = new Set();
  const slugKey = normalizeKey(row.slug);
  const nameKey = normalizeKey(row.name);
  const hostKey = websiteHostKey(row.website);
  if (slugKey) keys.add(slugKey);
  if (nameKey) keys.add(nameKey);
  if (hostKey) keys.add(hostKey);
  return keys;
}

function hasAliasOverlap(left, right) {
  for (const key of left) {
    if (right.has(key)) return true;
  }
  return false;
}

async function readVerifiedGeneratedAliasSets() {
  try {
    const raw = await readFile(generatedCatalogPath, "utf8");
    const parsed = JSON.parse(raw);
    const companies = Array.isArray(parsed?.companies) ? parsed.companies : [];
    return companies
      .filter((company) => String(company?.verificationStatus || "").trim() === "verified")
      .map((company) =>
        profileAliasKeys({
          slug: company?.slug,
          name: company?.name,
          website: company?.website,
        })
      );
  } catch {
    return [];
  }
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
  const verifiedProfiles = await sql`
    SELECT slug, name, payload->>'website' AS website
    FROM company_profiles
    WHERE verification_status = 'verified'
  `;
  const verifiedAliasSets = verifiedProfiles.map(profileAliasKeys);
  const verifiedGeneratedAliasSets = await readVerifiedGeneratedAliasSets();
  const allVerifiedAliasSets = [...verifiedAliasSets, ...verifiedGeneratedAliasSets];

  const activeRows = rows.filter((row) => {
    const submissionKeys = submissionAliasKeys(row);
    return !allVerifiedAliasSets.some((profileKeys) => hasAliasOverlap(submissionKeys, profileKeys));
  });

  const queue = {
    dataYear: new Date().getUTCFullYear(),
    catalogUpdated: new Date().toISOString().slice(0, 10),
    disclaimer: "Active community submissions awaiting review or in progress.",
    companies: activeRows.map(buildQueueProfile),
  };

  await mkdir(dirname(queuePath), { recursive: true });
  await writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  const suppressed = rows.length - activeRows.length;
  console.log(`Wrote ${queue.companies.length} active review records to ${queuePath}.`);
  if (suppressed > 0) {
    console.log(`Suppressed ${suppressed} active submission(s) that already match verified profiles.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}