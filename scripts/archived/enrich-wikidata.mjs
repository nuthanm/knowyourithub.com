#!/usr/bin/env node
/**
 * Fetch public facts from Wikidata to draft company entries.
 * Always review output before merging into data/companies.json.
 *
 * Usage: node scripts/enrich-wikidata.mjs "Razorpay" razorpay
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [,, nameArg, slugArg] = process.argv;

if (!nameArg || !slugArg) {
  console.error('Usage: node scripts/enrich-wikidata.mjs "Company Name" slug');
  process.exit(1);
}

async function searchWikidata(label) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", label);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikidata search failed: ${res.status}`);
  const json = await res.json();
  return json.search?.[0];
}

async function fetchEntity(id) {
  const url = new URL("https://www.wikidata.org/wiki/Special:EntityData/" + id + ".json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikidata entity fetch failed: ${res.status}`);
  const json = await res.json();
  return json.entities?.[id];
}

function claimValue(entity, propId) {
  const claim = entity?.claims?.[propId]?.[0];
  if (!claim) return undefined;
  const dv = claim.mainsnak?.datavalue;
  if (!dv) return undefined;
  if (dv.type === "string") return dv.value;
  if (dv.type === "time") return dv.value?.time?.slice(1, 5);
  if (dv.type === "globecoordinate") return `${dv.value.latitude}, ${dv.value.longitude}`;
  return undefined;
}

async function main() {
  const hit = await searchWikidata(nameArg);
  if (!hit) {
    console.error("No Wikidata match. Try a more specific name.");
    process.exit(1);
  }

  const entity = await fetchEntity(hit.id);
  const founded = claimValue(entity, "P571");
  const website = claimValue(entity, "P856");
  const description = hit.description || entity.descriptions?.en?.value;

  const draft = {
    slug: slugArg,
    name: hit.label || nameArg,
    category: "unknown",
    tagline: description?.slice(0, 120) || "Verify and write a tagline",
    description: description || "Verify description from official About page.",
    website: website || "https://",
    founded: founded || undefined,
    hq: "Verify HQ from official site",
    domains: [],
    tags: [],
    lastVerified: new Date().toISOString().slice(0, 10),
    sources: [
      { label: "Wikidata", url: `https://www.wikidata.org/wiki/${hit.id}` },
      ...(website ? [{ label: "Official website (Wikidata)", url: website }] : []),
    ],
    _draftNote:
      "DRAFT — review all fields, set category, add official sources, then merge into data/companies.json",
  };

  const outDir = join(process.cwd(), "data", "drafts");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${slugArg}.draft.json`);
  writeFileSync(outPath, JSON.stringify(draft, null, 2) + "\n");
  console.log(`Draft written: ${outPath}`);
  console.log("Next: verify on official site, set category, merge into data/companies.json");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
