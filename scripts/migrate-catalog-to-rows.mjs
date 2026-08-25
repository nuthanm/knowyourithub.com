import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const queuePath = resolve(root, "data", "companies.json");
const generatedCatalogPath = resolve(root, "data", "catalog.generated.json");
const backupDirectory = resolve(root, "data", "backups");

const rawQueue = await readFile(queuePath, "utf8");
const queueCatalog = JSON.parse(rawQueue);
if (!Array.isArray(queueCatalog?.companies)) {
  throw new Error("data/companies.json must contain companies[] before migration.");
}

const rawGenerated = await readFile(generatedCatalogPath, "utf8");
const generatedCatalog = JSON.parse(rawGenerated);
if (!Array.isArray(generatedCatalog?.companies) || generatedCatalog.companies.length === 0) {
  throw new Error("data/catalog.generated.json must contain the catalog before migration.");
}

await mkdir(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupDirectory, `companies.pre-row-migration.${stamp}.json`);
await copyFile(queuePath, backupPath);

const push = spawnSync(process.execPath, ["scripts/catalog-push-db.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (push.status !== 0) {
  throw new Error(`Row migration failed; companies.json remains unchanged. Backup: ${backupPath}`);
}

const pendingCatalog = {
  dataYear: generatedCatalog.dataYear,
  catalogUpdated: new Date().toISOString().slice(0, 10),
  disclaimer: "Active community submissions awaiting review or in progress.",
  companies: queueCatalog.companies.filter(
    (company) => company.verificationStatus === "unverified" || company.verificationStatus === "in_progress",
  ),
};

await writeFile(queuePath, `${JSON.stringify(pendingCatalog, null, 2)}\n`, "utf8");
console.log(`Migrated ${generatedCatalog.companies.length} companies to individual DB rows.`);
console.log(`Backed up the original queue file to ${backupPath}.`);
console.log(`Kept ${pendingCatalog.companies.length} active review records in data/companies.json.`);