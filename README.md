# Know Your IT Hub

Know your company type before you apply.

[![CI](https://img.shields.io/github/actions/workflow/status/nuthanm/knowyourcompanytype/ci.yml?label=CI&logo=github)](https://github.com/nuthanm/knowyourcompanytype/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Zod](https://img.shields.io/badge/Zod-v4-3068B7)](https://zod.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Optional-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/github/license/nuthanm/knowyourcompanytype)](LICENSE)

Site: https://knowyourithub.com

## Contribution Standards

Repository standards for data verification, the database-first review workflow, API security,
accessibility, and validation are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

![Know Your IT Hub hero section showing verified company directory and career research intent](https://github.com/user-attachments/assets/95a828da-bd92-4d42-8340-67266dde76f4)

## Purpose

Job seekers, especially people switching companies, often find scattered or vague information when comparing potential employers. This project gives a minimal, useful, and source-linked company view so visitors can decide faster and with less noise.

Core goal:

- Show only useful details that help career decisions.
- Keep the catalog verifiable with citations.
- Make community corrections easy through submit and feedback workflows.

## Problem We Solve

- Company type (product, service, hybrid) is often unclear on job portals.
- Public discussions can be outdated, opinionated, or not source-backed.
- Candidates need one place with consistent structure and clear verification status.

## What Visitors Get

- Searchable company profiles with category and verification status.
- Source-linked profile fields and data freshness metadata.
- Progress indicators for verified, in-progress, and awaiting-review entries.
- Submit and feedback forms for corrections and additions.

## Tech Stack

### Application

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4

### Validation, Security, and Delivery

- Zod for schema validation
- Math CAPTCHA + anti-bot checks + rate limiting
- Nodemailer for notifications
- Vercel for deployment

### Storage

- PostgreSQL `company_profiles`, with one row per catalog company
- data/companies.json for active portal submissions only (`awaiting_review` / `in_progress`)
- Optional PostgreSQL storage for submissions
- Local JSON-backed queue fallback for development; production review queues require PostgreSQL or Upstash Redis
- Optional PostgreSQL snapshots for catalog distribution to keep repo data private

## Architecture

```mermaid
flowchart TB
  subgraph Frontend["Web App"]
    UI["Next.js App Router pages"]
    DATA["Catalog read: PostgreSQL company_profiles"]
  end

  subgraph APIs["Form and Queue APIs"]
    SUBMIT["POST /api/submissions"]
    FEED["POST /api/feedback"]
    CONTACT["POST /api/contact"]
    CAPTCHA["GET /api/captcha"]
    QUEUE["GET /api/submissions/queue"]
  end

  subgraph Controls["Security and Controls"]
    BOT["Honeypot + timing checks"]
    LIMIT["Rate limiting"]
    SAN["Input sanitization"]
    MAIL["SMTP notifications"]
  end

  subgraph Storage["Persistence"]
    PG[("PostgreSQL optional")]
    JSONQ["Pending queue JSON fallback"]
  end

  UI --> DATA
  UI --> SUBMIT
  UI --> FEED
  UI --> CONTACT
  UI --> CAPTCHA
  SUBMIT --> BOT --> LIMIT --> SAN --> MAIL
  FEED --> BOT
  CONTACT --> BOT
  SUBMIT --> PG
  SUBMIT --> JSONQ
  QUEUE --> PG
  QUEUE --> JSONQ
```

## Behaviour flow

### Flow 1 — submit and queue a request

Files involved:
- [app/api/submissions/route.ts](app/api/submissions/route.ts) or the submit handler entry point
- [lib/api/submit-handler.ts](lib/api/submit-handler.ts)
- [lib/submissions.ts](lib/submissions.ts)
- [lib/subscribers.ts](lib/subscribers.ts)

Behavior:
- A visitor submits an add or edit request from the portal.
- The request is validated, sanitized, and checked for duplicate or already-known companies.
- The record is inserted into the review queue (`company_submissions`) with status `awaiting_review`.
- The item is shown on the review page as awaiting review until a maintainer confirms the record.
- If the submitter opts in, their email is stored in `catalog_subscribers` and they receive the welcome email.

### Flow 2 — enrich and move to in progress

Files involved:
- [lib/submissions.ts](lib/submissions.ts)
- [lib/email-templates.ts](lib/email-templates.ts)
- [app/api/submissions/queue/status/route.ts](app/api/submissions/queue/status/route.ts)
- [data/companies.json](data/companies.json)

Behavior:
- A maintainer opens the queue and updates the company record with verified details.
- The queue status moves from `awaiting_review` to `in_progress`.
- The code keeps the queue row active and synchronizes the draft record into PostgreSQL.
- The profile stays in a pending state with `verificationStatus` set to `in_progress` until final verification is complete.
- The notification email is sent only to the original submitter for `in_progress`, not to all subscribers.
- This matches the handwritten flow from the note: it is a personal update to the submitter during verification.

### Flow 3 — verified company goes live

Files involved:
- [lib/submissions.ts](lib/submissions.ts)
- [lib/email-templates.ts](lib/email-templates.ts)
- [scripts/sync-companies-db.mjs](scripts/sync-companies-db.mjs)
- [data/companies.json](data/companies.json)

Behavior:
- Once approval is complete, the queue item is set to `verified`.
- The verified company is removed from the review queue and added to the published catalog.
- The canonical profile is stored in PostgreSQL `company_profiles` and read directly by the website.
- A broadcast email is sent to all active subscribers for the verified company update.
- The URL should resolve to the final company details route such as `/companies/<slug>`.

### Status mapping used by the project

This project intentionally separates queue status from catalog profile status:

- Queue status: `awaiting_review`, `in_progress`, `verified`, `rejected`
- Catalog/profile status: `unverified`, `in_progress`, `verified`

The mapping is:

- `awaiting_review` -> `unverified`
- `in_progress` -> `in_progress`
- `verified` -> `verified`

This keeps the admin review queue clean while still allowing the public catalog to show a simple status model.

### Current code alignment

The code was previously broadcasting every non-rejected status update to all subscribers. That was not aligned with the handwritten flow.

The logic has been corrected so that:

- `in_progress` sends a mail only to the original submitter
- `verified` sends a mail to all subscribers
- `awaiting_review` does not broadcast to all subscribers

The notification behavior is now aligned with the three flow stages described above.

### Operational controls

- Rate limiting for abuse prevention.
- Honeypot/timing bot detection.
- CAPTCHA challenge token verification.
- Input sanitization and suspicious-character rejection.
- CORS handling for cross-origin safety.

This project intentionally separates queue status from catalog profile status:

- Queue status: `awaiting_review`, `in_progress`, `verified`, `rejected`
- Catalog/profile status: `unverified`, `in_progress`, `verified`

The mapping is:

- `awaiting_review` -> `unverified`
- `in_progress` -> `in_progress`
- `verified` -> `verified`

This keeps the admin review queue clean while still allowing the public catalog to show a simple status model.

### Current code alignment

The code was previously broadcasting every non-rejected status update to all subscribers. That was not aligned with the handwritten flow.

The logic has been corrected so that:

- `in_progress` sends a mail only to the original submitter
- `verified` sends a mail to all subscribers
- `awaiting_review` does not broadcast to all subscribers

The notification behavior is now aligned with the three flow stages described above.

### Operational controls

- Rate limiting for abuse prevention.
- Honeypot/timing bot detection.
- CAPTCHA challenge token verification.
- Input sanitization and suspicious-character rejection.
- CORS handling for cross-origin safety.

## Company Data Process

The canonical catalog is stored as one row per company in PostgreSQL `company_profiles`.
`data/companies.json` is intentionally small: it contains only active portal submissions that are
awaiting review or in progress.

Typical workflow:

1. Draft a company profile (optionally via enrichment scripts).
2. Validate details against official sources.
3. Set category, verification status, and source links.
4. Update lastVerified and related metadata.
5. Synchronize the verified profile to PostgreSQL.

Helper scripts (examples):

- npm run enrich:wikidata -- "Company Name" slug
- scripts/merge-enrichments.mjs
- scripts/fill-remaining-gaps.mjs

## Email Templates and Notifications

The project uses automated email notifications to keep submitters and subscribers informed about company profile updates through the submission workflow.

### Email Templates Overview

Email notifications are sent at three key workflow stages:

#### 1. User Submission Acknowledgment
**Sent to**: Original submitter  
**Trigger**: When a company submission is first created  
**Purpose**: Confirm receipt and provide submission reference

![User submit a new company request - Acknowledge mail to user](Mail%20Images/User%20submit%20a%20new%20company%20request%20-%20Acknowledge%20mail%20to%20user.png)

This email acknowledges the submitter's company profile contribution and confirms that their submission has been received and is awaiting review in the queue.

#### 2. Owner Notification of Company Request
**Sent to**: Maintainer/admin  
**Trigger**: When a new company submission is queued  
**Purpose**: Alert the team about pending reviews

![Owner receives the company request](Mail%20Images/Owner%20receives%20the%20company%20request.png)

This notification ensures maintainers are aware of new company submissions that require verification and validation against official sources.

#### 3. Subscriber Notification on Verification
**Sent to**: All active subscribers  
**Trigger**: When a company profile is verified and published  
**Purpose**: Inform subscribers about newly verified company data

![Subscriber Receive when company is verified](Mail%20Images/Subscriber%20Receive%20when%20company%20is%20verified%20.png)

This email notifies subscribers that a company profile has been thoroughly reviewed and verified, making it available in the searchable catalog.

### Email Configuration

Email templates are managed in [lib/email-templates.ts](lib/email-templates.ts) and sent via Nodemailer using SMTP configuration from environment variables:

- `SMTP_HOST` — SMTP server address
- `SMTP_PORT` — SMTP port (typically 587 or 465)
- `SMTP_USER` — SMTP authentication username
- `SMTP_PASSWORD` — SMTP authentication password
- `SMTP_FROM` — Sender email address

Email sending functions:
- `sendNewSubmissionEmail()` — User acknowledgment
- `sendOwnerNotificationEmail()` — Maintainer alert
- `sendSubscriberNotificationEmail()` — Subscriber broadcast

---

## Data Quality & Audits

The project maintains data quality through periodic audits and sync verification to ensure the catalog stays accurate and consistent across storage layers.

### Audit Results

Latest audit snapshot (`audit-results.json`):

```json
{
  "totalCompanies": 109,
  "reference": "astrazeneca",
  "inSync": 108,
  "outOfSync": 0,
  "auditedAt": "2026-07-23",
  "results": []
}
```

**Audit Metrics**:
- **Total Companies**: 109 company profiles in catalog
- **In Sync**: 108 profiles verified and synchronized between DB and JSON files
- **Out of Sync**: 0 discrepancies found
- **Sync Status**: ✅ 99.08% (108/109) consistency across storage layers
- **Last Audit**: July 23, 2026

### Data Validation

The project includes validation checks for:

- Required fields presence (company name, category, website)
- Domain format validation
- URL validity and accessibility
- Tag and service description completeness
- Source link citation integrity
- Verification status consistency

### Sync Verification

The codebase includes diagnostic utilities to verify data consistency:

```bash
# Check database storage counts
npm run scripts/audit-company-storage.mjs

# Test database connection and retrieve metadata
npm run scripts/diagnose-company-storage-connection.mjs
```

These utilities help ensure:
- PostgreSQL database connectivity
- Accurate company profile counts
- Metadata consistency between local JSON and database
- No orphaned or duplicate records

### Data Enrichment

When adding or updating company profiles, use:

```bash
# Research company via Wikidata API
node scripts/enrich-wikidata.mjs "Company Name" slug
```

This tool pulls structured data like founding year, official website, and company description from Wikidata and creates draft JSON files for manual review before integration.

---

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

### Local testing workflow

1. Start the app locally:
   ```bash
   npm run dev
   ```
2. Open the submit form on `/submit` and create a company request.
3. Confirm the submission is stored in the review queue and visible on `/coming-soon`.
4. Update the queue status via the moderation console or API.
5. Test the three stages:
   - `awaiting_review` shows the item in the review queue
   - `in_progress` sends a direct email to the submitter only
   - `verified` pushes the company to the catalog and broadcasts to all subscribers
6. Check the generated catalog and queue JSON files after each status change.

### Local moderation API examples

```bash
curl -X POST http://localhost:3000/api/submissions/queue/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -d '{
    "id": "<submission-id>",
    "status": "in_progress",
    "companyName": "Newgen Software",
    "companySlug": "newgen-software"
  }'
```

For a verified transition:

```bash
curl -X POST http://localhost:3000/api/submissions/queue/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -d '{
    "id": "<submission-id>",
    "status": "verified",
    "companyName": "Newgen Software",
    "companySlug": "newgen-software"
  }'
```

## Environment and Deployment

- Deploy target: Vercel
- Environment template: .env.example
- Production review queue persistence: configure PostgreSQL via DATABASE_URL, or both Upstash variables
- Local-only queue fallback: JSON file storage when neither persistence provider is configured
- Optional API hardening: ADMIN_API_KEY and CORS origins
- Review queue moderation: set REVIEW_QUEUE_PASSCODE (or use ADMIN_API_KEY as its fallback)

## Local-to-DB sync and deployment sync

### Local sync model

The published catalog is read directly from PostgreSQL. Local JSON files are used only for review-queue drafts and public development samples.

The local files are:

- `data/companies.json` — active queue/profile draft entries and pending review entries
- `data/pending.json` — fallback queue used when DB is not available

The DB tables are:

- `company_submissions` — review queue rows
- `company_profiles` — canonical, verified catalog rows
- `catalog_subscribers` — subscriber email list
- `company_catalog_metadata` — catalog snapshot metadata

### Sync review queue state after verification

```bash
npm run companies:sync-db
```

This syncs verified draft rows into `company_profiles` and marks matching submissions in `company_submissions` as `verified`. Published pages read `company_profiles` directly.

### After pushing changes to the repo

1. Push the branch to GitHub.
2. Deploy to Vercel.
3. Configure `DATABASE_URL` in the deployment environment.
4. The deployed app reads the latest verified profile data directly from `company_profiles`.

### Recommended local workflow for maintainers

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then:

- submit a company from the UI
- review it in the moderation queue
- change the queue status from `awaiting_review` to `in_progress`
- verify it as `verified`
- run `npm run companies:sync-db` to ensure DB and catalog data remain in sync
- push the branch and redeploy application code when necessary; catalog data is served directly from the database

Catalog sync commands:

- npm run catalog:migrate-to-rows (one-time, backup-first migration from the legacy catalog)
- npm run companies:sync-db

Build behavior:

- `npm run build` does not create or refresh a catalog cache.
- Production deployments require `DATABASE_URL` for published catalog data.

Catalog row schema:

- db/catalog.sql
- db/companies.sql
- db/submissions.sql

Pull request database sync workflow:

- GitHub Actions workflow: .github/workflows/companies-db-sync.yml
- Triggers on branch pushes and pull requests when sync-related files change (data, db, scripts, package.json)
- Runs a single orchestration command: `npm run sync:workflow`
- Sequence inside `sync:workflow`:
  - `npm run submissions:migrate-verified`
  - `npm run companies:sync-db`
  - `npm run public:sanitize-data`

Required pipeline secrets/env for full DB-backed generation:

- `DATABASE_URL` (required for published catalog reads and DB sync/migration)
- `NEXT_PUBLIC_SITE_URL` (recommended for generated links)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (required only if email delivery is expected during sync)

Notes:

- If `DATABASE_URL` is missing, DB-dependent steps will fail or skip depending on script behavior.
- `npm run build` reads no catalog data from local JSON files.

## Data Visibility and Private Catalog Guidance

Important: data inside tracked files is public in git history when pushed.

If your catalog must stay private, use this approach:

1. Keep sensitive catalog in an untracked private file (for example data/companies.private.json).
2. Add private file patterns to .gitignore.
3. Commit only a sanitized sample file for public repositories.
4. If data was already committed, rotate/move sensitive values and rewrite history if legally required.

Current repository note:

- This codebase reads verified profiles from PostgreSQL `company_profiles` and active review entries from data/companies.json.
- To fully hide catalog content from public viewers, you must stop tracking sensitive data files and publish only sanitized data.

### Zero-Downtime rollout (recommended)

1. Apply DB schema:
  - Run db/catalog.sql on production PostgreSQL.
2. Push current catalog snapshot to DB:
  - npm run catalog:push-db
3. Configure production `DATABASE_URL`.
4. Deploy application.
5. Validate catalog pages and search in production.
6. After validation, remove tracked catalog from git history policy:
  - Keep data/companies.json gitignored.
  - Untrack existing file once team is ready: git rm --cached data/companies.json

For local/public development without private data:

- Keep data/companies.example.json in repo.
- it is used only to generate sanitized development data.

This order avoids downtime because existing app behavior remains unchanged while source-of-truth transitions to DB.

## Attribution and Disclosures

- Community-maintained directory; not affiliated with listed companies.
- Information can change over time; always cross-check with official sources before making career decisions.
- External references and brand names belong to their respective owners.
- This platform is informational and does not guarantee hiring outcomes.

## Copyright

Copyright (c) 2026 Nuthan Murarysetty.
All trademarks and company names referenced in profiles remain property of their respective owners.

## License and Forking Clarification

This repository currently includes an MIT license in LICENSE.

If your intent is to prevent others from forking/reusing code, MIT is not suitable. You should replace LICENSE with a restrictive/proprietary license before publishing that policy.

Until LICENSE is changed, usage rights are governed by the current LICENSE file.
