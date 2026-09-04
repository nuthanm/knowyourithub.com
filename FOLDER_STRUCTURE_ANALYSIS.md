# Complete Folder Structure Analysis
**Generated**: September 4, 2026  
**Scope**: d:\My work\knowyourcompanytype

---

## Executive Summary

| Category | Count | Action |
|----------|-------|--------|
| **Source Folders** | 17 | Keep (actively used) |
| **Empty Folders** | 3 | Review/Delete |
| **Backup/Reference Folders** | 1 | Archive or Delete |
| **Build Artifacts** | 7+ | Auto-generated (ignore) |

---

## 1. CORE APPLICATION FOLDERS

### ✅ **app/** — Next.js Pages & Routes
**Location**: `app/`  
**Files**: 7  
**Subfolders**: 14 (all active)  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `layout.tsx` — Root layout
- `page.tsx` — Home page
- `robots.ts` — SEO robots.txt generator
- `sitemap.ts` — SEO sitemap generator
- `globals.css` — Global styles
- 14 subfolders: `about/`, `brief/`, `coming-soon/`, `companies/`, `contact/`, `feedback/`, `privacy-policy/`, `prototype/`, `styles/`, `submit/`, `terms-and-conditions/`, `api/`

**Referenced**: YES (imported in 20+ files)  
**Empty**: NO  
**Risk**: **LOW** — Core to application  
**Recommendation**: **KEEP** — Do not modify

---

### ✅ **app/api/** — API Routes
**Location**: `app/api/`  
**Files**: 0 (in root)  
**Subfolders**: 4  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `captcha/route.ts` — Math captcha verification endpoint
- `contact/route.ts` — Contact form submission
- `feedback/route.ts` — Feedback form submission
- `submissions/route.ts` + queue management routes (8 files total)
  - `submissions/queue/route.ts` — List pending submissions
  - `submissions/queue/accept/route.ts` — Accept submission to catalog
  - `submissions/queue/moderate/route.ts` — Moderation workflow
  - `submissions/queue/status/route.ts` — Status updates

**Referenced**: YES (API routes actively called)  
**Empty**: YES (no files in root, but subfolders have content)  
**Risk**: **LOW** — Critical API infrastructure  
**Recommendation**: **KEEP** — Do not modify

---

### ✅ **app/styles/** — Application Stylesheets
**Location**: `app/styles/`  
**Files**: 3  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `app.css` — Main application styles
- `presentation.css` — Presentation/brief page styles
- `prototype.css` — Prototype page styles

**Referenced**: YES (imported in layout files)  
**Empty**: NO  
**Risk**: **LOW** — Active styling  
**Recommendation**: **KEEP**

---

### ✅ **components/** — React Components
**Location**: `components/`  
**Files**: 25 (in root)  
**Subfolders**: 1  
**Status**: ✅ ACTIVE & REFERENCED

**Root Files** (25 components):
- `AdSense.tsx`, `AlphabetIndex.tsx`, `AppHeader.tsx`, `AppSelect.tsx`, `AppShell.tsx`, `BrandMark.tsx`, `CatalogProgress.tsx`, `CategoryGuide.tsx`, `CompanyCard.tsx`, `CompanySearchInput.tsx`, `CompanySubmissionForm.tsx`, `ContactForm.tsx`, `CookieConsent.tsx`, `DataNotice.tsx`, `FeedbackForm.tsx`, `FormLayout.tsx`, `GlobalCompanySearch.tsx`, `MathCaptchaField.tsx`, `PipelineQueue.tsx`, `PortalIcons.tsx`, `PresentationDeck.tsx`, `SubmitPageContent.tsx`, `SubscriberPill.tsx`, `VerificationStatusTag.tsx`, `VerifiedStamp.tsx`

**Subfolders**:
- `charts/` — 2 chart components
  - `AreaLineChart.tsx`
  - `BarChartSimple.tsx`

**Referenced**: YES (imported in 50+ files)  
**Empty**: NO  
**Risk**: **LOW** — Core UI components  
**Recommendation**: **KEEP**

---

### ✅ **components/charts/** — Chart Components
**Location**: `components/charts/`  
**Files**: 2  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `AreaLineChart.tsx` — Chart for presentation deck
- `BarChartSimple.tsx` — Chart for presentation deck

**Referenced**: YES (used in `PresentationDeck.tsx`)  
**Empty**: NO  
**Risk**: **LOW** — Actively used  
**Recommendation**: **KEEP**

---

## 2. FEATURE MODULES

### ✅ **features/** — Feature Organization
**Location**: `features/`  
**Files**: 0 (in root)  
**Subfolders**: 5  
**Status**: ✅ ACTIVE & REFERENCED

**Structure**:
- `about/` → `about-page.tsx` (1 file)
- `companies/` → `company-directory.tsx` (1 file)
- `company/` → `company-detail.tsx`, `company-pipeline-detail.tsx` (2 files)
- `home/` → `home-page.tsx` (1 file)
- `policy/` → `policy-pages.tsx` (1 file)

**Total Files**: 6  
**Referenced**: YES (imported in 7 app routes)  
**Empty**: YES (no files in root, but all subfolders have content)  
**Risk**: **LOW** — Feature organization pattern  
**Recommendation**: **KEEP** — Clean architectural pattern

---

## 3. LIBRARY & UTILITIES

### ✅ **lib/** — Core Business Logic
**Location**: `lib/`  
**Files**: 15 (in root)  
**Subfolders**: 2  
**Status**: ✅ ACTIVE & REFERENCED

**Root Files** (15):
- `catalog-drafts.ts` — Draft catalog management
- `chartData.ts` — Chart data generation
- `companies.ts` — Main company catalog (imported by 40+ files)
- `company-search.ts` — Company search functionality
- `contact-store.ts` — Contact submission storage
- `email-templates.ts` — Email template builder
- `feedback-store.ts` — Feedback storage
- `mockData.ts` — Mock/sample data for prototypes
- `pending-queue-store.ts` — Submission queue storage
- `site-meta.ts` — Site metadata & URLs (imported by 30+ files)
- `site-stats.ts` — Site statistics (imported by 3 files)
- `submissions-shared.ts` — Shared submission types
- `submissions.ts` — Submission management
- `subscribers.ts` — Subscriber management
- `validators.ts` — Form validation schemas (imported by 10+ files)

**Subfolders**:
- `api/` — 2 files
- `security/` — 7 files

**Referenced**: YES (81 imports found for `@/lib/*`)  
**Empty**: NO  
**Risk**: **LOW** — Core functionality  
**Recommendation**: **KEEP** — Do not modify

---

### ✅ **lib/api/** — API Utilities
**Location**: `lib/api/`  
**Files**: 2  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `cors.ts` — CORS handling & JSON response utilities
- `submit-handler.ts` — Form submission handler (used by contact, feedback, submission APIs)

**Referenced**: YES (imported by 6 API routes)  
**Empty**: NO  
**Risk**: **LOW** — Critical API infrastructure  
**Recommendation**: **KEEP**

---

### ✅ **lib/security/** — Security Utilities
**Location**: `lib/security/`  
**Files**: 7  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `anti-bot.ts` — Bot detection
- `index.ts` — Security utilities export
- `mailer.ts` — Email sending
- `math-captcha.ts` — Math captcha generation & verification
- `queue-token.ts` — Queue moderation token management
- `rate-limit.ts` — Rate limiting
- `sanitize.ts` — Input sanitization

**Referenced**: YES (imported by multiple API routes)  
**Empty**: NO  
**Risk**: **LOW** — Critical security functions  
**Recommendation**: **KEEP**

---

## 4. DATA & PERSISTENCE

### ✅ **data/** — Application Data
**Location**: `data/`  
**Files**: 7  
**Subfolders**: 1  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `companies.json` — **GITIGNORED** but imported at runtime (active submissions + reviews)
- `catalog.generated.json` — Generated catalog from PostgreSQL (fallback to example)
- `companies.example.json` — Public example/template data
- `pipeline.json` — Fortune 500 pipeline stubs (unverified companies)
- `site-stats.json` — Site statistics (subscriber count, verification rate)
- `fortune500-2025-source.txt` — Reference data source
- `.env` — Environment variables (local)

**Subfolders**:
- `backups/` — Empty (cleaned up)

**Referenced**: YES
- `companies.json` → imported by `lib/companies.ts`
- `catalog.generated.json` → imported by `lib/companies.ts`, generated by scripts
- `pipeline.json` → imported by `lib/companies.ts`
- `site-stats.json` → imported by 3 components + lib

**Empty**: NO  
**Risk**: **LOW** — Critical data files  
**Recommendation**: **KEEP**

---

### ⚠️ **data/backups/** — Backup Folder
**Location**: `data/backups/`  
**Files**: 0  
**Status**: ✅ EMPTY (Cleaned up)

**Context**: Previous cleanup removed 4 migration backup files.

**Referenced**: NO  
**Empty**: YES  
**Risk**: **LOW** — Already empty  
**Recommendation**: **DELETE FOLDER** (already cleaned, folder can be removed)

---

### ✅ **db/** — Database Schemas
**Location**: `db/`  
**Files**: 6  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `catalog.sql` — Catalog table schema
- `companies.sql` — Companies table schema
- `contact.sql` — Contact submissions table schema
- `feedback.sql` — Feedback submissions table schema
- `submissions.sql` — Company submissions table schema
- `subscribers.sql` — Subscribers table schema

**Referenced**: YES
- Referenced in `.github/workflows/companies-db-sync.yml`
- Referenced in README.md documentation
- Used in `scripts/` for database initialization

**Empty**: NO  
**Risk**: **MEDIUM** — Critical for database setup  
**Recommendation**: **KEEP** — Archive to docs if DB infrastructure moves

---

## 5. SCRIPTS & TOOLING

### ✅ **scripts/** — Automation Scripts
**Location**: `scripts/`  
**Files**: 9 (active)  
**Subfolders**: 1  
**Status**: ✅ ACTIVE & REFERENCED

**Active Scripts** (9):
- `add-fortune500-pipeline.mjs` — Add Fortune 500 companies to pipeline
- `catalog-pull-db.mjs` — Pull catalog from PostgreSQL → `data/catalog.generated.json`
- `catalog-push-db.mjs` — Push catalog from JSON → PostgreSQL
- `load-env.mjs` — Load environment variables
- `sanitize-public-data.mjs` — Remove sensitive data from public files
- `set-submission-status.mjs` — Update submission status
- `setup-vercel-env.ps1` — PowerShell script for Vercel environment setup
- `sync-companies-db.mjs` — Sync companies between DB and JSON
- `sync-review-queue-json.mjs` — Sync review queue state

**Subfolders**:
- `archived/` — 3 legacy diagnostic scripts

**Referenced**: YES
- 9 scripts referenced in `package.json` as npm commands
- 6 scripts referenced in `.github/workflows/companies-db-sync.yml`

**Empty**: NO  
**Risk**: **LOW** — Operational automation  
**Recommendation**: **KEEP** — Essential for deployment pipeline

---

### ✅ **scripts/archived/** — Legacy Scripts
**Location**: `scripts/archived/`  
**Files**: 3  
**Status**: ✅ ORGANIZED & DOCUMENTED

**Contents**:
- `audit-company-storage.mjs` — Diagnostic: check company storage
- `diagnose-company-storage-connection.mjs` — Diagnostic: test DB connection
- `enrich-wikidata.mjs` — Enrichment: pull data from Wikidata (bootstrap only)

**Referenced**: NO (optional diagnostic tools)  
**Empty**: NO  
**Risk**: **LOW** — Historical reference  
**Recommendation**: **KEEP** — Periodically review quarterly

---

## 6. METADATA & CONFIGURATION

### ✅ **public/** — Static Assets
**Location**: `public/`  
**Files**: 3  
**Status**: ✅ ACTIVE & REFERENCED

**Contents**:
- `ads.txt` — AdSense configuration
- `favicon.svg` — Site favicon
- `logo.svg` — Site logo

**Referenced**: YES (used in HTML/layouts)  
**Empty**: NO  
**Risk**: **LOW** — Static assets  
**Recommendation**: **KEEP**

---

### ✅ **Mail Images/** — Email Assets
**Location**: `Mail Images/`  
**Files**: 3  
**Status**: ✅ PRESENT & POTENTIALLY ACTIVE

**Contents**:
- `Owner receives the company request.png` — Email template asset
- `Subscriber Receive when company is verified .png` — Email template asset
- `User submit a new company request - Acknowledge mail to user.png` — Email template asset

**Referenced**: POSSIBLY (may be referenced in email templates)  
**Empty**: NO  
**Risk**: **MEDIUM** — Email assets may be active  
**Recommendation**: **KEEP** (verify in email template implementation if still used)

---

### ⚠️ **types/** — Type Definitions
**Location**: `types/`  
**Files**: 0  
**Status**: ⚠️ EMPTY

**Context**: 
- Folder exists but is empty
- TypeScript types defined inline in source files
- `next-env.d.ts` in root handles generated types

**Referenced**: NO (types are inline)  
**Empty**: YES  
**Risk**: **LOW** — Already unused  
**Recommendation**: **DELETE FOLDER** (not needed, use inline types or tsconfig paths if needed)

---

## 7. REFERENCE & BUILD ARTIFACTS

### 🚫 **_yieldproof-ref/** — Backup/Reference Project
**Location**: `_yieldproof-ref/`  
**Files**: 48 total  
**Subfolders**: Multiple (app/, components/, lib/, public/, etc.)  
**Status**: ⚠️ BACKUP/LEGACY

**Contents**:
- Complete copy of earlier project version
- Includes: configuration files, old components, old app structure
- Contains: `.github/workflows/`, `package.json`, `tsconfig.json`, `README.md`, etc.

**Referenced**: NO
- Explicitly excluded in `.gitignore`
- Excluded in `eslint.config.mjs`
- Excluded in `tsconfig.json` (ts exclude list)

**Empty**: NO  
**Risk**: **HIGH** — Large backup folder not needed  
**Recommendation**: **DELETE or ARCHIVE**
- Option A: Delete entirely (safe if backed up externally)
- Option B: Archive to separate Git branch/repository
- Option C: Keep only if active reference needed

**Action**: Can safely delete without affecting main application

---

## 8. BUILD & CONFIGURATION ARTIFACTS

### ℹ️ **Auto-Generated Folders** (Can Ignore)
These are generated by Next.js build process and should not be manually edited:

| Folder | Purpose | Action |
|--------|---------|--------|
| `.next/` | Next.js build output | Auto-generated, git-ignored |
| `.vercel/` | Vercel deployment config | Auto-generated |
| `.cursor/` | Cursor IDE settings | IDE-specific |
| `.github/` | GitHub Actions workflows | Keep, version controlled |
| `.vscode/` | VS Code settings | IDE-specific |
| `node_modules/` | NPM dependencies | Auto-installed from package.json |

---

## SUMMARY TABLE: ALL SOURCE FOLDERS

| Folder | Files | Referenced | Empty | Risk | Recommendation |
|--------|-------|-----------|-------|------|-----------------|
| `app/` | 7 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `app/api/` | 8 (recursive) | ✅ YES | YES (root) | 🟢 LOW | **KEEP** |
| `app/styles/` | 3 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `components/` | 25 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `components/charts/` | 2 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `features/` | 6 | ✅ YES | YES (root) | 🟢 LOW | **KEEP** |
| `lib/` | 15 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `lib/api/` | 2 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `lib/security/` | 7 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `data/` | 7 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `data/backups/` | 0 | NO | ✅ YES | 🟢 LOW | **DELETE FOLDER** |
| `db/` | 6 | ✅ YES | NO | 🟠 MEDIUM | **KEEP** |
| `scripts/` | 9 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `scripts/archived/` | 3 | NO | NO | 🟢 LOW | **KEEP** (review quarterly) |
| `public/` | 3 | ✅ YES | NO | 🟢 LOW | **KEEP** |
| `Mail Images/` | 3 | ? | NO | 🟠 MEDIUM | **VERIFY** then decide |
| `types/` | 0 | NO | ✅ YES | 🟢 LOW | **DELETE FOLDER** |
| `_yieldproof-ref/` | 48 | NO | NO | 🔴 HIGH | **DELETE or ARCHIVE** |

---

## CLEANUP RECOMMENDATIONS

### Priority 1: Safe Deletions (No Risk)
1. ✅ **Delete `types/` folder** (empty, not used)
   - Impact: None
   - Time: 1 minute
   
2. ✅ **Delete `data/backups/` folder** (already empty)
   - Impact: None
   - Time: 1 minute

### Priority 2: Review & Decide (Medium Priority)
1. ⚠️ **Review `Mail Images/` folder usage**
   - Check if email templates use these image files
   - If not used → Delete
   - If used → Verify they work in email templates

2. ⚠️ **Review `_yieldproof-ref/` usage**
   - Confirm no code references it (already confirmed)
   - Decide: Delete entirely or archive?
   - If deleting: Backup externally first
   - Impact: Frees ~5-10 MB
   - Time: 5 minutes

### Priority 3: Quarterly Reviews
1. 📅 **Review `scripts/archived/` quarterly**
   - Check if any archived scripts become needed
   - Remove scripts that are truly obsolete
   - Currently: 3 diagnostic scripts (safe to keep)

---

## CLEANUP CHECKLIST

```markdown
- [ ] Delete `types/` folder (empty, unused)
- [ ] Delete `data/backups/` folder (already empty)
- [ ] Review `Mail Images/` — check email template implementation
  - [ ] If unused: Delete folder
  - [ ] If used: Document file usage in comments
- [ ] Decide on `_yieldproof-ref/` folder
  - [ ] Option A: Delete entirely
  - [ ] Option B: Archive to separate branch/repo
  - [ ] Document decision in CLEANUP_REPORT.md
- [ ] Run `npm run build` to verify no broken imports
- [ ] Run `npm run lint` to verify no linting errors
- [ ] Commit cleanup changes
```

---

## CODEBASE HEALTH METRICS

| Metric | Value | Status |
|--------|-------|--------|
| Empty source folders | 3 | ⚠️ Can be cleaned |
| Unreferenced source folders | 2 (`scripts/archived/`, `Mail Images/` pending) | ✅ Documented |
| Backup/reference folders | 1 (`_yieldproof-ref/`) | ⚠️ Should archive/delete |
| Build artifacts (ignored) | 7+ | ✅ Properly ignored |
| Active source folders | 15 | ✅ Healthy |
| Active lib modules | 15 | ✅ No dead code |
| Active scripts | 9 | ✅ All documented |

---

## REFERENCES

- Previous cleanup: `CLEANUP_REPORT.md`
- Script analysis: `SCRIPTS_ANALYSIS.md`
- Company data flow: `/memories/repo/data-flow.md`
- Cleanup status: `/memories/repo/cleanup-status.md`

