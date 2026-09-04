#!/usr/bin/env node
import { readFile, writeFile, rm, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

const companiesPath = resolve(root, "data", "companies.json");
const companiesExamplePath = resolve(root, "data", "companies.example.json");

const removablePaths = [
  resolve(root, "data", "companies.private.json"),
  resolve(root, "data", "pipeline.private.json"),
  resolve(root, "data", "enrichments"),
  resolve(root, "data", "drafts"),
];

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertCatalogShape(value) {
  if (!value || typeof value !== "object") throw new Error("Catalog payload must be an object.");
  if (!Array.isArray(value.companies)) throw new Error("Catalog payload requires companies[] array.");
  if (typeof value.dataYear !== "string" && typeof value.dataYear !== "number") {
    throw new Error("Catalog payload requires dataYear.");
  }
}

async function sanitizeCompaniesJson() {
  const raw = await readFile(companiesExamplePath, "utf8");
  const sample = JSON.parse(raw);
  assertCatalogShape(sample);
  await writeFile(companiesPath, `${JSON.stringify(sample, null, 2)}\n`, "utf8");
  console.log("Sanitized data/companies.json using data/companies.example.json");
}

async function removeOptionalDataFiles() {
  for (const target of removablePaths) {
    if (await pathExists(target)) {
      await rm(target, { recursive: true, force: true });
      console.log(`Removed optional path: ${target}`);
    }
  }
}

async function main() {
  await sanitizeCompaniesJson();
  await removeOptionalDataFiles();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
