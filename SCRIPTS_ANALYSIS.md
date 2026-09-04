# Archived Scripts Analysis & Decision Guide

**Analysis Date**: September 4, 2026

---

## 🚨 Mystery File Alert

**File**: `String.fromCodePoint(...c)` (at project root)
- **Type**: Empty junk file (0 bytes)
- **Recommendation**: ❌ **DELETE IMMEDIATELY**
- **Risk**: None (empty file, likely corrupted filename)

---

## Archived Scripts Breakdown

### ✅ KEEP (3 scripts) — Useful for Ongoing Maintenance

#### 1. **audit-company-storage.mjs** (844 B)
```
Purpose: Database diagnostic tool
What it does: Connects to PostgreSQL and shows counts:
  - Total company profiles in database
  - Verified submissions
  - Active submissions (awaiting review, in progress)
When to use: When troubleshooting database issues or verifying data sync
Keep because: Reusable diagnostic utility for ongoing maintenance
```

#### 2. **diagnose-company-storage-connection.mjs** (854 B)
```
Purpose: Database connection diagnostic
What it does: Tests database connectivity and retrieves:
  - Database name, host, schema info
  - IP address information
  - Profile and submission counts
When to use: When you can't connect to the database or need DB metadata
Keep because: Critical for troubleshooting connection issues
```

#### 3. **enrich-wikidata.mjs** (3.4 KB)
```
Purpose: Reusable CLI research tool
What it does: Searches Wikidata API for company information:
  - Searches by company name
  - Returns: founder year, website, description
  - Creates draft JSON files for manual review before merging
Usage: node scripts/enrich-wikidata.mjs "Company Name" slug
Keep because: Useful for ongoing research when adding new companies
```

---

### ❌ SAFE TO DELETE (8 scripts) — One-Time Migrations/Enrichments

#### Group A: Data Audit Scripts (1 script)
**1. audit-astrazeneca-sync.mjs** (3.1 KB)
- What: Audited companies.json for missing fields (23 required fields checked)
- Status: ⏳ One-time audit (hardcoded date: mid-2024)
- Can delete: ✅ YES (already run and completed)

---

#### Group B: Data Enrichment Scripts (2 scripts)
**2. enrich-missing-urls.mjs** (3.4 KB)
- What: Filled missing LinkedIn URLs using hardcoded company mapping (100+ entries)
- Status: ⏳ One-time enrichment (applied to companies.json already)
- Can delete: ✅ YES (all LinkedIn URLs already filled in)

**3. fill-remaining-gaps.mjs** (17.7 KB) — **LARGEST SCRIPT**
- What: Massive batch enrichment with 6 hardcoded lookup tables:
  1. Indian company headcount (17 companies)
  2. Twitter handles (80+ companies)
  3. Vision statements (80+ companies)
  4. Leadership info (10 entries)
  5. MNC India headcount (8 companies)
  6. IT services headcount (20 companies)
- Status: ⏳ One-time/periodic enrichment (already applied)
- Can delete: ✅ YES (all data already merged into companies.json)

---

#### Group C: Batch Consolidation/Merge Scripts (2 scripts)
**4. merge-enrichments.mjs** (1.9 KB)
- What: Merged batch enrichment files from `data/enrichments/` folder
- Status: ⏳ One-time consolidation (completed)
- Can delete: ✅ YES (all batches already merged)

**5. merge-pipeline-batch.mjs** (57 KB) — **SECOND LARGEST**
- What: Major pipeline migration with curated data for 30+ companies:
  - phonepe, swiggy, wipro, zomato, paytm, hcltech, tech-mahindra, meesho, cred, ola, zerodha, groww, nykaa, delhivery, ltimindtree, cognizant, amazon-india, etc.
  - Migrated pipeline stubs to verified profiles in companies.json
  - Then cleared the pipeline.json
- Status: ⏳ Major one-time migration (Jul 2026)
- Can delete: ✅ YES (migration completed, pipeline.json cleared)

---

#### Group D: Database Migration Scripts (3 scripts) — **CRITICAL MIGRATIONS**
**6. migrate-catalog-to-rows.mjs** (2.2 KB)
- What: CRITICAL - Migrated entire catalog from `companies.json` → PostgreSQL database
- Status: ⏳ One-time major migration (completed)
- Complexity: Created timestamped backups before migration
- Can delete: ✅ YES (migration to database completed)
- ⚠️ Note: This is safe to delete because the data is already in the database

**7. migrate-verified-submissions.mjs** (3.4 KB)
- What: Migrated verified submissions from `company_submissions` table to `company_profiles` table
- Status: ⏳ One-time consolidation (completed)
- Actions: Merged verified submissions by slug, then DELETED old rows from submissions table
- Can delete: ✅ YES (consolidation completed)
- ⚠️ Note: This is safe to delete because data was already migrated

**8. list-migrated-company-profiles.mjs** (782 B)
- What: Reported on newly migrated company profiles (queried verified profiles from today)
- Status: ⏳ One-time reporting (completed)
- Can delete: ✅ YES (reporting script, no ongoing use)

---

## Summary Table

| Script | Size | Type | Status | Delete? | Risk |
|--------|------|------|--------|---------|------|
| audit-company-storage.mjs | 844 B | Diagnostic | Keep | ❌ No | None |
| diagnose-company-storage-connection.mjs | 854 B | Diagnostic | Keep | ❌ No | None |
| enrich-wikidata.mjs | 3.4 KB | CLI Tool | Keep | ❌ No | None |
| audit-astrazeneca-sync.mjs | 3.1 KB | One-time | Done | ✅ Yes | Low |
| enrich-missing-urls.mjs | 3.4 KB | One-time | Done | ✅ Yes | Low |
| fill-remaining-gaps.mjs | 17.7 KB | One-time | Done | ✅ Yes | Low |
| merge-enrichments.mjs | 1.9 KB | One-time | Done | ✅ Yes | Low |
| merge-pipeline-batch.mjs | 57 KB | One-time | Done | ✅ Yes | Low |
| migrate-catalog-to-rows.mjs | 2.2 KB | One-time | Done | ✅ Yes | Low |
| migrate-verified-submissions.mjs | 3.4 KB | One-time | Done | ✅ Yes | Low |
| list-migrated-company-profiles.mjs | 782 B | One-time | Done | ✅ Yes | Low |
| **String.fromCodePoint(...c)** | **0 B** | **Junk** | **N/A** | ✅ **Delete** | **None** |

---

## Recommended Actions

### Immediate Deletions (Safe, No Risk)
- ❌ Delete: `String.fromCodePoint(...c)` — Empty junk file
- ❌ Delete 8 archived migration/enrichment scripts:
  1. audit-astrazeneca-sync.mjs
  2. enrich-missing-urls.mjs
  3. fill-remaining-gaps.mjs
  4. merge-enrichments.mjs
  5. merge-pipeline-batch.mjs
  6. migrate-catalog-to-rows.mjs
  7. migrate-verified-submissions.mjs
  8. list-migrated-company-profiles.mjs

**Total space recovered**: ~97 KB

### Keep in Archive (Ongoing Use)
- ✅ Keep: audit-company-storage.mjs
- ✅ Keep: diagnose-company-storage-connection.mjs
- ✅ Keep: enrich-wikidata.mjs

**Total space to keep**: ~5 KB

### Before Deleting
Consider moving these 3 keeper scripts to a dedicated `scripts/diagnostics/` folder for better organization:
```
scripts/diagnostics/
  ├── audit-company-storage.mjs
  ├── diagnose-company-storage-connection.mjs
  └── enrich-wikidata.mjs
```

---

## Analysis Summary

✅ **High Confidence Assessment**: All 8 archive scripts are one-time migrations/enrichments that completed their purpose.

✅ **No Active Dependencies**: None of the build scripts, Next.js routes, or components reference these archived scripts.

✅ **Data Already Applied**: All enrichment data is already merged into companies.json and/or PostgreSQL database.

✅ **Safe to Remove**: Zero risk of breaking anything by deleting these 8 scripts.

⚠️ **One Cleanup**: The `String.fromCodePoint(...c)` file is a junk file with corrupted name—definitely delete.

---

**Cleanup Status**: Ready for your confirmation to proceed with deletions.
