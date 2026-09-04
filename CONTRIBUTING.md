# Contribution Standards

Know Your IT Hub is a source-linked career research directory. Changes must preserve factual accuracy, a clear review workflow, and a reliable production experience.

## Required Before Every Change

1. Read the nearest implementation, route, schema, and existing tests before editing.
2. Keep changes focused on the requested behavior. Do not combine unrelated refactors with a feature or fix.
3. Never commit secrets, credentials, database URLs, tokens, or personal data. Use `.env.local` locally and deployment environment variables in production.
4. Run the relevant validation before opening a pull request. At minimum, run `npm run build` and `npm run lint` for cross-cutting changes.

## Company Data Standards

- Use only official or authoritative sources for company facts: company websites, careers pages, investor relations, annual reports, and official leadership pages.
- Do not use blogs, job-review sites, or Wikipedia as a sole source for published facts.
- Every company profile must include a valid official website, concise factual description, category, headquarters, at least two domains, sources, and `lastVerified`.
- Classify companies by their primary business model: `product`, `service`, `hybrid`, or `unknown` only when official sources are insufficient.
- Do not invent leadership titles, headcount, work model, locations, products, or services. Omit facts that cannot be verified.
- Use the existing complete profiles as examples: `astrazeneca` for global product companies, `razorpay` or `zoho` for Indian product companies, and `tcs` or `infosys` for service companies.

## Database-First Review Workflow

PostgreSQL is the source of truth for requests and profiles.

| Stage | Storage | Required outcome |
| --- | --- | --- |
| New portal or mail request | `company_submissions` | Create an `awaiting_review` request only. Do not write a queue entry to `data/companies.json`. |
| Research | `company_profiles` and temporary local payload | Check for an existing request/profile first, research official sources, synchronize the complete profile as `in_progress`, and retain the request as `in_progress`. |
| Publish | `company_profiles` | Synchronize the profile as `verified`, then remove the matching `company_submissions` row. |

- Review Queue displays only active database requests: `awaiting_review` and `in_progress`.
- New-company duplicate checks must compare canonical company identities, including common legal suffix variants such as `Ltd` and `Pvt Ltd`.
- Modification requests require a selected existing company and must remain distinguishable from new-company requests.
- Use `npm run companies:find-request -- "Company Name"` before researching a requested company.
- Use `node scripts/sync-companies-db.mjs` after preparing an in-progress or verified profile. Remove its temporary entry from `data/companies.json` only after a successful sync.

## Application and API Standards

- Use TypeScript, existing local helpers, and established component patterns.
- Validate request payloads with Zod at API boundaries. Treat browser validation as convenience only; enforce important rules on the server.
- Maintain CAPTCHA, rate limiting, honeypot/timing checks, sanitization, and CORS handling on public form endpoints.
- API reads must not perform unrelated writes, file synchronization, email delivery, or per-row reconciliation.
- Keep public queue endpoints read-only. Email moderation tokens must be scoped to a single submission and must not authorize actions on other requests.
- Return actionable error messages without exposing implementation details, credentials, or database internals.

## UI and Accessibility Standards

- Match the existing visual system: restrained white/cream surfaces, brand blue for primary actions, orange for awaiting review, and blue for in-progress states.
- Build responsive layouts that remain usable at mobile and desktop widths. Do not rely on fixed viewport heights or overflow-dependent navigation.
- Use semantic controls, visible labels, keyboard focus states, and descriptive accessible names.
- Use clear, action-oriented labels such as `Submit request` and `View Verified Companies`.
- Keep content dense enough for operational pages. Avoid duplicate navigation, decorative cards, and unnecessary instructional copy.

## Validation Checklist

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] New or modified public forms are checked for valid input, invalid input, CAPTCHA behavior, and duplicate handling.
- [ ] Queue changes are checked for `awaiting_review`, `in_progress`, rejection, and request-scoped moderation behavior.
- [ ] Company changes include official source URLs and preserve the database-first workflow.
- [ ] UI changes are checked at narrow and wide viewport sizes with keyboard focus visible.

## Pull Request Expectations

- Use a specific title that describes the user-facing or data-flow impact.
- Include a short summary, validation commands run, and any migration or environment changes.
- Call out data corrections, source links, queue-status effects, and email behavior when relevant.
- Do not merge changes with known build, lint, security, or data-verification failures.