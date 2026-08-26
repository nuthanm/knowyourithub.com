import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import nodemailer from "nodemailer";
import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.log("DATABASE_URL is missing or placeholder. Skipping company sync.");
  process.exit(0);
}

const generatedCatalogPath = resolve(process.cwd(), "data", "catalog.generated.json");
const companiesJsonPath = resolve(process.cwd(), "data", "companies.json");
const pipelinePath = resolve(process.cwd(), "data", "pipeline.json");

// Determine which file to read: prefer companies.json (source of truth), fall back to catalog.generated.json
let catalogPath;
try {
  await access(companiesJsonPath);
  catalogPath = companiesJsonPath;
  console.log("Using data/companies.json as source (user-editable source of truth)");
} catch {
  catalogPath = generatedCatalogPath;
  console.log("Using data/catalog.generated.json as source (generated from DB)");
}

function normalizeStatus(value) {
  if (value === "verified" || value === "in_progress" || value === "unverified") return value;
  return "unverified";
}

function isMailerConfigured() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  return Boolean(host && user && pass && !host.includes("replace") && !user.includes("your@gmail.com") && !pass.includes("replace"));
}

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function isValidEmail(value) {
  if (!value) return false;
  const email = String(value).trim();
  return /.+@.+\..+/.test(email);
}

const raw = await readFile(catalogPath, "utf8");
const catalog = JSON.parse(raw);
if (!catalog || !Array.isArray(catalog.companies)) {
  throw new Error("Company data file must contain companies[] array");
}

const companies = catalog.companies;
if (companies.length === 0) {
  console.log("No companies found in source file. Skipping sync.");
  process.exit(0);
}

const verifiedSlugs = companies
  .filter((company) => normalizeStatus(company.verificationStatus) === "verified")
  .map((company) => String(company.slug || "").trim())
  .filter(Boolean);

const verifiedNames = companies
  .filter((company) => normalizeStatus(company.verificationStatus) === "verified")
  .map((company) => String(company.name || "").trim())
  .filter(Boolean);

const inProgressSlugs = companies
  .filter((company) => normalizeStatus(company.verificationStatus) === "in_progress")
  .map((company) => String(company.slug || "").trim())
  .filter(Boolean);

const inProgressNames = companies
  .filter((company) => normalizeStatus(company.verificationStatus) === "in_progress")
  .map((company) => String(company.name || "").trim())
  .filter(Boolean);

console.log(`Extracted verified: slugs=${JSON.stringify(verifiedSlugs)}, names=${JSON.stringify(verifiedNames)}`);
console.log(`Extracted in_progress: slugs=${JSON.stringify(inProgressSlugs)}, names=${JSON.stringify(inProgressNames)}`);

const allCatalogSlugs = new Set(
  companies
    .map((company) => String(company.slug || "").trim())
    .filter(Boolean),
);

async function prunePipelineJson() {
  try {
    const rawPipeline = await readFile(pipelinePath, "utf8");
    const parsed = JSON.parse(rawPipeline);
    const inProgress = Array.isArray(parsed?.inProgress) ? parsed.inProgress : [];
    const unverified = Array.isArray(parsed?.unverified) ? parsed.unverified : [];

    const nextInProgress = inProgress.filter((item) => {
      const slug = String(item?.slug || "").trim();
      return !slug || !allCatalogSlugs.has(slug);
    });
    const nextUnverified = unverified.filter((item) => {
      const slug = String(item?.slug || "").trim();
      return !slug || !allCatalogSlugs.has(slug);
    });

    const changed =
      nextInProgress.length !== inProgress.length || nextUnverified.length !== unverified.length;

    if (!changed) return { removed: 0 };

    const next = {
      ...parsed,
      inProgress: nextInProgress,
      unverified: nextUnverified,
    };

    await writeFile(pipelinePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    const removed = inProgress.length + unverified.length - nextInProgress.length - nextUnverified.length;
    return { removed };
  } catch {
    return { removed: 0 };
  }
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const newlyVerified = [];
  const newlyInProgress = [];

  await sql.begin(async (tx) => {
    await tx`
      CREATE TABLE IF NOT EXISTS company_profiles (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        last_verified TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    for (const company of companies) {
      const slug = String(company.slug || "").trim();
      if (!slug) continue;
      const name = String(company.name || slug).trim();
      const category = String(company.category || "unknown").trim();
      const verificationStatus = normalizeStatus(company.verificationStatus);
      const lastVerified = company.lastVerified ? String(company.lastVerified) : null;

      await tx`
        INSERT INTO company_profiles (slug, name, category, verification_status, last_verified, payload, updated_at)
        VALUES (${slug}, ${name}, ${category}, ${verificationStatus}, ${lastVerified}, ${tx.json(company)}, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          verification_status = EXCLUDED.verification_status,
          last_verified = EXCLUDED.last_verified,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `;
    }

    // For verified: update all in_progress records to verified if they match our catalog
    if (verifiedSlugs.length > 0 || verifiedNames.length > 0) {
      // Query existing in_progress submissions to match against
      const existingSubmissions = await tx`
        SELECT id, company_name, company_slug, submitter_name, submitter_email
        FROM company_submissions
        WHERE status = 'in_progress'
      `;

      console.log(`Found ${existingSubmissions.length} existing in_progress submissions to check for verification`);

      for (const submission of existingSubmissions) {
        const subName = String(submission.company_name || "").toLowerCase().trim();
        const subSlug = String(submission.company_slug || "").toLowerCase().trim();
        
        // Check if this submission matches any verified entry
        const matchesBySlug = subSlug && verifiedSlugs.includes(subSlug);
        const matchesByName = verifiedNames.some(n => String(n || "").toLowerCase().trim() === subName);
        
        if (matchesBySlug || matchesByName) {
          await tx`
            UPDATE company_submissions
            SET status = 'verified', updated_at = NOW()
            WHERE id = ${submission.id}
          `;
          
          newlyVerified.push({
            companyName: String(submission.company_name || "").trim(),
            companySlug: String(submission.company_slug || "").trim(),
            submitterName: String(submission.submitter_name || "").trim(),
            submitterEmail: String(submission.submitter_email || "").trim(),
          });
          
          console.log(`Verified submission: ${submission.company_name} (matched by ${matchesBySlug ? 'slug' : 'name'})`);
        }
      }
    }

    // For in_progress: update all awaiting_review records to in_progress if they match our catalog
    if (inProgressSlugs.length > 0 || inProgressNames.length > 0) {
      // Query existing awaiting_review submissions to match against
      const existingSubmissions = await tx`
        SELECT id, company_name, company_slug, submitter_name, submitter_email
        FROM company_submissions
        WHERE status = 'awaiting_review'
      `;

      console.log(`Found ${existingSubmissions.length} existing awaiting_review submissions to check for in_progress`);

      for (const submission of existingSubmissions) {
        const subName = String(submission.company_name || "").toLowerCase().trim();
        const subSlug = String(submission.company_slug || "").toLowerCase().trim();
        
        // Check if this submission matches any in_progress entry
        const matchesBySlug = subSlug && inProgressSlugs.includes(subSlug);
        const matchesByName = inProgressNames.some(n => String(n || "").toLowerCase().trim() === subName);
        
        if (matchesBySlug || matchesByName) {
          await tx`
            UPDATE company_submissions
            SET status = 'in_progress', updated_at = NOW()
            WHERE id = ${submission.id}
          `;
          
          newlyInProgress.push({
            companyName: String(submission.company_name || "").trim(),
            companySlug: String(submission.company_slug || "").trim(),
            submitterName: String(submission.submitter_name || "").trim(),
            submitterEmail: String(submission.submitter_email || "").trim(),
          });
          
          console.log(`Updated to in_progress: ${submission.company_name} (matched by ${matchesBySlug ? 'slug' : 'name'})`);
        }
      }
    }
  });

  if (newlyVerified.length > 0 && isMailerConfigured()) {
    const subscribers = await sql<Array<{ email: string }>>`
      SELECT email
      FROM catalog_subscribers
      ORDER BY created_at DESC
      LIMIT 300
    `;

    if (subscribers.length > 0) {
      const transport = getTransport();
      if (transport) {
        const requesterSent = new Set();
        for (const company of newlyVerified) {
          const profilePath = company.companySlug ? `/companies/${company.companySlug}` : "/coming-soon";
          const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
          const subject = `[Know Your IT Hub] ${company.companyName} status update: Verified`;
          const text = [
            `${company.companyName} moved to: Verified`,
            "",
            "A company request completed review and is now verified in the catalog.",
            `Track status: ${site}/coming-soon`,
            `View profile: ${site}${profilePath}`,
          ].join("\n");

          for (const subscriber of subscribers) {
            const to = String(subscriber.email || "").trim();
            if (!to) continue;
            try {
              await transport.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to,
                subject,
                text,
                html: `<p><strong>${company.companyName}</strong> moved to <strong>Verified</strong>.</p><p>A company request completed review and is now verified in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
            } catch {
              // Keep sync successful if individual email delivery fails.
            }
          }

          const requesterEmail = String(company.submitterEmail || "").trim().toLowerCase();
          const requesterName = company.submitterName || "there";
          const requesterDedupKey = `${requesterEmail}|${company.companySlug || company.companyName}`;
          if (isValidEmail(requesterEmail) && !requesterSent.has(requesterDedupKey)) {
            requesterSent.add(requesterDedupKey);
            try {
              await transport.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to: requesterEmail,
                subject: `[Know Your IT Hub] Your request for ${company.companyName} is now Verified`,
                text: [
                  `Hi ${requesterName},`,
                  "",
                  `Great news: your request for ${company.companyName} is now verified in the catalog.`,
                  "",
                  `Track status: ${site}/coming-soon`,
                  `View profile: ${site}${profilePath}`,
                ].join("\n"),
                html: `<p>Hi ${requesterName},</p><p>Great news: your request for <strong>${company.companyName}</strong> is now <strong>Verified</strong> in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
            } catch {
              // Keep sync successful if requester notification fails.
            }
          }
        }
      }
    }
  }

  if (newlyInProgress.length > 0 && isMailerConfigured()) {
    const subscribers = await sql<Array<{ email: string }>>`
      SELECT email
      FROM catalog_subscribers
      ORDER BY created_at DESC
      LIMIT 300
    `;

    if (subscribers.length > 0) {
      const transport = getTransport();
      if (transport) {
        const requesterSent = new Set();
        for (const company of newlyInProgress) {
          const profilePath = company.companySlug ? `/companies/${company.companySlug}` : "/coming-soon";
          const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
          const subject = `[Know Your IT Hub] ${company.companyName} status update: In Progress`;
          const text = [
            `${company.companyName} moved to: In Progress`,
            "",
            "A company request is now under review in the catalog.",
            `Track status: ${site}/coming-soon`,
            `View profile: ${site}${profilePath}`,
          ].join("\n");

          for (const subscriber of subscribers) {
            const to = String(subscriber.email || "").trim();
            if (!to) continue;
            try {
              await transport.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to,
                subject,
                text,
                html: `<p><strong>${company.companyName}</strong> moved to <strong>In Progress</strong>.</p><p>A company request is now under review in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
            } catch {
              // Keep sync successful if individual email delivery fails.
            }
          }

          const requesterEmail = String(company.submitterEmail || "").trim().toLowerCase();
          const requesterName = company.submitterName || "there";
          const requesterDedupKey = `${requesterEmail}|${company.companySlug || company.companyName}`;
          if (isValidEmail(requesterEmail) && !requesterSent.has(requesterDedupKey)) {
            requesterSent.add(requesterDedupKey);
            try {
              await transport.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to: requesterEmail,
                subject: `[Know Your IT Hub] Your request for ${company.companyName} is now In Progress`,
                text: [
                  `Hi ${requesterName},`,
                  "",
                  `Great news: your request for ${company.companyName} is now under review in the catalog.`,
                  "",
                  `Track status: ${site}/coming-soon`,
                  `View profile: ${site}${profilePath}`,
                ].join("\n"),
                html: `<p>Hi ${requesterName},</p><p>Great news: your request for <strong>${company.companyName}</strong> is now <strong>In Progress</strong> in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
            } catch {
              // Keep sync successful if requester notification fails.
            }
          }
        }
      }
    }
  }

  console.log(`Synced ${companies.length} companies to company_profiles.`);
  console.log(`Marked submission rows verified for ${verifiedSlugs.length} verified slugs and ${verifiedNames.length} verified names. Updated ${newlyVerified.length} records.`);
  console.log(`Marked submission rows in_progress for ${inProgressSlugs.length} in_progress slugs and ${inProgressNames.length} in_progress names. Updated ${newlyInProgress.length} records.`);
  const pruned = await prunePipelineJson();
  if (pruned.removed > 0) {
    console.log(`Removed ${pruned.removed} synced entries from data/pipeline.json.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
