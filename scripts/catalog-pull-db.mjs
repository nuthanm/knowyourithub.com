import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const args = new Set(process.argv.slice(2));
const fromBuild = args.has("--build");
const required =
  args.has("--required") ||
  ["1", "true", "yes"].includes((process.env.CATALOG_DB_REQUIRED ?? "").trim().toLowerCase());
const pullOnBuild = ["1", "true", "yes"].includes(
  (process.env.CATALOG_PULL_ON_BUILD ?? "").trim().toLowerCase(),
);

const dbUrl = process.env.DATABASE_URL?.trim();
const root = process.cwd();
const outPath = resolve(root, "data", "companies.json");
const samplePath = resolve(root, "data", "companies.example.json");

function isUsableDbUrl(url) {
  return Boolean(url && !url.includes("replace") && !url.includes("user:password"));
}

if (fromBuild && !pullOnBuild) {
  console.log("Skipping DB catalog pull during build. Set CATALOG_PULL_ON_BUILD=true to enable.");
  process.exit(0);
}

function assertCatalogShape(value) {
  if (!value || typeof value !== "object") throw new Error("Catalog payload must be an object.");
  if (!Array.isArray(value.companies)) throw new Error("Catalog payload requires companies[] array.");
  if (typeof value.dataYear !== "string" && typeof value.dataYear !== "number") {
    throw new Error("Catalog payload requires dataYear.");
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureCatalogFromSample(reason) {
  const hasCatalog = await pathExists(outPath);
  if (hasCatalog) return false;

  const hasSample = await pathExists(samplePath);
  if (!hasSample) {
    const message = `${reason} No catalog file or sample file available.`;
    if (required) {
      console.error(message);
      process.exit(1);
    }
    console.log(message);
    return false;
  }

  const sampleRaw = await readFile(samplePath, "utf8");
  const payload = JSON.parse(sampleRaw);
  assertCatalogShape(payload);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Catalog missing. Wrote sample catalog from ${samplePath}`);
  return true;
}

if (!isUsableDbUrl(dbUrl)) {
  const message = "DATABASE_URL not configured. Skipping DB catalog pull.";
  if (required) {
    console.error(message);
    process.exit(1);
  }
  await ensureCatalogFromSample(`${message}`);
  console.log(message);
  process.exit(0);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const rows = await sql`
    SELECT payload
    FROM company_catalog_snapshots
    WHERE is_active = TRUE
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;

  const payload = rows[0]?.payload;
  if (!payload) {
    const message = "No active catalog snapshot found in DB. Skipping write.";
    if (required) {
      console.error(message);
      process.exit(1);
    }
    await ensureCatalogFromSample(`${message}`);
    console.log(message);
    process.exit(0);
  }

  assertCatalogShape(payload);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Catalog pulled from DB into ${outPath}`);
} catch (error) {
  const code = error && typeof error === "object" ? error.code : undefined;
  if (code === "42P01") {
    const message = "company_catalog_snapshots table is missing. Skipping DB catalog pull.";
    if (required) {
      console.error(message);
      process.exit(1);
    }
    await ensureCatalogFromSample(`${message}`);
    console.log(message);
    process.exit(0);
  }
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
