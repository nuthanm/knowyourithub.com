---
name: add-company
description: >-
  Research and add a new company profile to Know Your IT Hub from official sources.
  Use when the user says "Add this company", "Add company", "Add <name> to Know Your IT Hub",
  or asks to create, draft, or verify a company profile.
---

# Add Company to Know Your IT Hub

## Trigger phrases

- "Add this company: PhonePe"
- "Add company Meesho"
- "Verify Swiggy" / "Publish the Wipro profile"

## Before starting

1. Run `node scripts/find-company-request.mjs "Company Name"` first. It queries PostgreSQL by name and slug in `company_submissions` and `company_profiles`. Do not use `data/companies.json` for duplicate or queue checks.
2. If `company_profiles.verification_status` is `verified`, tell the user and offer to update fields instead.
3. If `company_submissions.status` is `awaiting_review` or `in_progress`, continue the research workflow for that request. If a matching profile is already `in_progress`, use its payload as the starting point.

Slug: use `slugifyCompanyName()` from `lib/companies.ts` (lowercase, hyphens).

The database is the queue authority. `data/companies.json` is a temporary, local research handoff only; never treat it as a queue or catalog source.

## Research rules

**Only use official or authoritative sources:**
- Company website (About, Careers, Products, Locations, **Leadership / Team**)
- Annual report / investor relations (headcount)
- LinkedIn company page (secondary — cross-check against official site)

**Never publish as fact:**
- Glassdoor, AmbitionBox, random blogs, Wikipedia alone
- Guessed headcount, work model, or category without a source URL

**Category classification** (`product` | `service` | `hybrid` | `unknown`):
- **product** — builds and sells own software/products (Razorpay, Zoho)
- **service** — client delivery, consulting, outsourcing (TCS, Infosys)
- **hybrid** — significant product AND services arms (Flipkart)
- **unknown** — only if official sources are ambiguous; explain in note

## Required fields (minimum draft)

| Field | Notes |
|-------|-------|
| `slug`, `name`, `category` | Required |
| `tagline` | One line, ≤120 chars |
| `description` | 1–2 sentences from official About copy |
| `website` | Official homepage |
| `hq` | City, country |
| `domains`, `tags` | At least 2 domains; tags like Unicorn, MNC |
| `sources` | Every fact must trace to a `{ label, url }` entry |
| `lastVerified` | Today's ISO date |
| `verificationStatus` | `"in_progress"` until user approves |

## Recommended fields (fill when available)

`founded`, `officeCities`, `officeCountries`, `totalOfficeLocations`, `locationsUrl`, `contactUrl`, `headcountIndia`, `headcountGlobal`, `headcountNote`, `products`, `services`, `onsitePolicy`, `careersUrl`, `linkedin`, `twitter`, `leadership`, `vision`

Optional Wikidata bootstrap: `node scripts/enrich-wikidata.mjs "Company Name" slug` — always replace draft fields with official sources.

## Profile UI — what renders where

The verified profile page (`features/company/company-detail.tsx`) uses a **3-column layout**:

| Column | Content |
|--------|---------|
| **Left sidebar** | Quick links (website, careers, LinkedIn, etc.) + **Leadership** panel |
| **Main column** | About, Locations, Domains & tags, Products, Services |
| **Right sidebar** | Headcount note, Sources, edit CTA |

There is **no "On this page" section nav** — do not expect or document anchor navigation in the sidebar.

### Leadership (left sidebar)

**Schema:**

```json
"leadership": [
  { "name": "Full Name", "role": "Founder & Chief Scientist" },
  { "name": "Full Name", "role": "Group CEO & Co-founder" },
  { "name": "Full Name", "role": "COO" }
]
```

**Research priority — add when officially published:**

1. **Main founder** — use role text that includes `Founder` but not `Co-founder` (e.g. `"Founder & CEO"`, `"Founder & Chief Scientist"`)
2. **Co-founders** — `"Co-founder"`, `"CEO & Co-founder"`, etc.
3. **CEO** — current group CEO if different from founder
4. **COO** — only if listed on official About / Leadership page
5. **CTO** — only if listed on official About / Leadership page

**Ordering:** The app sorts automatically via `sortLeadership()` in `lib/companies.ts` (founder → co-founder → CEO → COO → CTO → others). You may list entries in any order in JSON; sorting is applied at render time.

**Do not invent roles.** If a company has no public COO or CTO (common at large corps), omit them. Division heads (e.g. "CEO, ManageEngine") are acceptable when cited from the official About page — prefer group-level C-suite when available.

**Main founder highlight:** Entries where `role` contains `founder` but not `co-founder` get visual emphasis via `isMainFounder()`.

**Good examples in catalog:** `zoho` (founder + group CEO + co-founder), `razorpay` (CEO & Co-founder, CTO & Co-founder), `kanini` (CEO & Founder, COO).

### Locations (main column)

Shown when `shouldShowLocationsSection()` returns true — typically when there are multiple `officeCities`, `officeCountries`, or an official presence link.

| Field | UI behavior |
|-------|-------------|
| `hq` | Always shown in hero stats **and** as a highlighted HQ card inside Locations |
| `officeCities` | Rendered as city chips with map-pin icons (preview capped at 6 via `OFFICE_CITY_PREVIEW_LIMIT`) |
| `officeCountries` | Rendered as muted country chips |
| `locationsUrl` | Preferred outbound link ("Office locations" or "All offices (55 countries)") |
| `contactUrl` | Fallback outbound link ("Contact & locations") when no dedicated locations page |
| `totalOfficeLocations` | Used in the locations link label when set |

**Fill guidance:** Add `officeCities` for major hiring hubs (not every small office). Use `locationsUrl` when the company publishes an official worldwide/offices page; otherwise `contactUrl`.

### Domains & tags (main column)

Always shown. **Keep domains and tags separate** — they render in two distinct groups:

| Array | Purpose | UI |
|-------|---------|-----|
| `domains` | Industry / capability (SaaS, Fintech, IT Services) | Filled green chips |
| `tags` | Company traits (Unicorn, MNC, Bootstrapped) | Dashed outline chips |

Minimum: **2 domains**. Add **1–3 tags** when they help discovery (e.g. `"Public company"`, `"Global delivery"`).

### Products & services (main column)

| Field | UI |
|-------|-----|
| `products` | Responsive grid tiles with package icons — use official product names |
| `services` | Same bullet-list pattern as before (service companies) |

Use concise official names (e.g. `"Zoho CRM"`, not marketing blurbs). Omit the section entirely if the array is empty.

### About (main column)

- `description` — required; 1–2 factual sentences
- `vision` — optional sub-block when the official site states a mission/vision

## Leadership role cheat sheet

| Role in data | When to use |
|--------------|-------------|
| `"Founder & …"` | Original/main founder; must not say "Co-founder" |
| `"… & Co-founder"` | Any co-founder |
| `"CEO"`, `"CEO & MD"`, `"Group CEO"` | Current chief executive |
| `"COO"` | Chief Operating Officer — official source only |
| `"CTO"`, `"CTO & Co-founder"` | Chief Technology Officer — official source only |

Avoid stale titles. If leadership changed recently (e.g. founder stepped down to another role), use the **current** title from the official About page and cite the source.

## Where to write data

### Step 1 — Find or create the database request

For an existing UI or mail request, read its `company_submissions` row. New manual requests must be created in `company_submissions` with:

```json
"status": "awaiting_review"
```

Do not add submission requests to `data/companies.json` or pending JSON. The Review Soon page reads only `company_submissions` rows with `awaiting_review` or `in_progress`.

### Step 2 — Research and synchronize an in-progress profile

Research the complete profile using the rules above. Add or update only this researched company in `data/companies.json` with:

```json
"verificationStatus": "in_progress"
```

Run:

```powershell
node scripts/sync-companies-db.mjs
```

The script upserts the full profile to `company_profiles` with `in_progress` and updates matching `company_submissions` rows to `in_progress`. Remove that company entry from `data/companies.json` after a successful sync. It will appear as **In progress** on `/coming-soon` directly from PostgreSQL.

### Step 3 — Present for review

After editing JSON, show the user a **review table**:

| Field | Value | Source |
|-------|-------|--------|
| Category | product | About page |
| … | … | … |

End with:
- Link path: `/companies/{slug}` (available once the verified profile is published)
- Ask: **"Review the draft above. Reply 'verify {name}' when ready to publish."**

Do **not** set `verified` unless the user explicitly approves.

### Step 4 — Verify (user approves)

When user says "verify", "publish", "looks good", or similar:

1. Read the in-progress `company_profiles` payload from PostgreSQL.
2. Write that profile temporarily to `data/companies.json`, set `verificationStatus` to `"verified"`, and set `lastVerified` to today.
3. Run `node scripts/sync-companies-db.mjs`. It upserts the verified profile and removes matching rows from `company_submissions`.
4. Remove that company entry from `data/companies.json` after the script succeeds.
5. Confirm: the profile is live at `/companies/{slug}` with the Verified badge and it is absent from `/coming-soon`.

## Reference profiles

### Gold standard — global MNC product company

Use **[AstraZeneca](https://knowyourithub.com/companies/astrazeneca/)** (`slug: astrazeneca`) as the template for any new **global, public, product-based MNC** with India hiring presence. Match its field coverage, tone, and UI density before submitting for review.

**Live reference:** https://knowyourithub.com/companies/astrazeneca/

**What a complete profile like AstraZeneca includes:**

| Section | Fields to fill |
|---------|----------------|
| Hero | `tagline`, `hq`, `founded`, `headcountIndia`, `headcountGlobal`, `headcountNote`, `onsitePolicy` |
| About | `description` (1–2 factual sentences), optional `vision` (official mission/vision quote) |
| Locations | `officeCountries`, `officeCities` (India hiring hubs), `totalOfficeLocations`, `locationsUrl`, `contactUrl` |
| Domains & tags | ≥2 `domains` (industry/capability) + 1–3 `tags` (traits like MNC, Public company) |
| Products | Official product/therapy/platform names — **not** marketing blurbs |
| Sidebar | `leadership` (group CEO; add CTO/COO only when officially listed), quick links |
| Sources | One `{ label, url }` per fact block (About, Leadership, India presence, Careers, Annual report, Contact) |

**Example JSON skeleton** (use as the temporary `data/companies.json` payload for `node scripts/sync-companies-db.mjs`):

```json
{
  "slug": "example-mnc",
  "name": "Example Corp",
  "category": "product",
  "tagline": "One-line official positioning (≤120 chars)",
  "description": "1–2 sentences from official About / 10-K copy.",
  "website": "https://www.example.com",
  "founded": "1999",
  "hq": "City, Country",
  "officeCities": ["Bengaluru", "Chennai", "Mumbai", "Pune", "Hyderabad"],
  "officeCountries": ["United Kingdom", "United States", "India"],
  "totalOfficeLocations": "100+ countries",
  "locationsUrl": "https://www.example.com/our-presence",
  "contactUrl": "https://www.example.com/contact",
  "headcountIndia": "4,500+",
  "headcountGlobal": "96,100",
  "headcountNote": "India per careers page; global per Annual Report — explain if entities differ",
  "domains": ["Industry A", "Industry B", "Healthcare"],
  "tags": ["MNC", "Public company", "R&D-intensive"],
  "products": ["Product line A", "Product line B"],
  "onsitePolicy": "Hybrid — role and site dependent; verify on careers page",
  "careersUrl": "https://careers.example.com/india",
  "linkedin": "https://www.linkedin.com/company/example",
  "twitter": "https://twitter.com/example",
  "leadership": [{ "name": "Full Name", "role": "CEO" }],
  "vision": "Official vision or mission quote from the company site.",
  "lastVerified": "2026-07-23",
  "verificationStatus": "in_progress",
  "sources": [
    { "label": "Our company", "url": "https://..." },
    { "label": "Leadership", "url": "https://..." },
    { "label": "India presence", "url": "https://..." },
    { "label": "Careers India", "url": "https://..." },
    { "label": "Annual Report", "url": "https://..." },
    { "label": "Contact", "url": "https://..." }
  ]
}
```

**Headcount rule:** Always cite the source in `headcountNote` when India and global figures come from different documents (e.g. careers page vs 10-K).

**India cities rule:** List major hiring hubs only (5–7 cities max); do not duplicate `hq` in `officeCities` unless HQ is also a hiring hub in India.

### Other reference profiles

Copy structure and tone from existing entries in `data/companies.json`:
- **Global MNC product:** `astrazeneca` (gold standard — see above)
- **Indian product:** `razorpay`, `zoho`, `freshworks`
- **Service:** `tcs`, `infosys`, `kanini` (leadership + multi-country locations)
- **Hybrid:** `flipkart`

**Leadership reference:** `zoho` (founder-first, multiple executives), `razorpay` (co-founder CEO/CTO), `kanini` (founder + COO), `astrazeneca` (group CEO only).

**Locations reference:** `astrazeneca` (`officeCountries` + India `officeCities` + `totalOfficeLocations`), `tcs` (`locationsUrl` + many cities), `zoho` (`officeCities` + `contactUrl`).

## Quality checklist

- [ ] Category matches what the company **builds** vs **delivers for clients**
- [ ] Every URL loads and matches the cited field
- [ ] `headcountNote` added when numbers are approximate
- [ ] `onsitePolicy` phrased cautiously ("Hybrid — verify on careers page")
- [ ] No duplicate URLs across `sources` and quick links (app dedupes automatically)
- [ ] Database lookup completed for matching `company_submissions` and `company_profiles` rows
- [ ] UI/mail request was not written to `data/companies.json`
- [ ] Temporary `data/companies.json` entry was removed after the in-progress or verified DB sync
- [ ] **Leadership:** main founder role uses `"Founder"` (not `"Co-founder"`); CEO/COO/CTO only when officially listed
- [ ] **Leadership:** roles reflect current titles, not outdated press coverage
- [ ] **Locations:** `officeCities` lists hiring hubs; HQ stays in `hq` only (not duplicated in cities unless it's also a major office)
- [ ] **Domains & tags:** at least 2 domains; traits go in `tags`, not mixed into `domains`
- [ ] **Products/services:** official names only; omit empty arrays

## Commands after edit

Run build or lint if JSON was changed significantly. Do not commit unless user asks.

## Code helpers (for agents)

| Helper | File | Purpose |
|--------|------|---------|
| `sortLeadership()` | `lib/companies.ts` | Sorts leadership for display (founder → co-founder → CEO → COO → CTO) |
| `isMainFounder(role)` | `lib/companies.ts` | Detects main-founder roles for UI highlight |
| `shouldShowLocationsSection()` | `lib/companies.ts` | Whether Locations card appears |
| `getOfficeCityPreview()` | `lib/companies.ts` | Caps city list at 6 for preview |
| `getOfficialPresenceLink()` | `lib/companies.ts` | Picks `locationsUrl` or `contactUrl` for outbound link |
| `slugifyCompanyName()` | `lib/companies.ts` | Generates URL slug |
