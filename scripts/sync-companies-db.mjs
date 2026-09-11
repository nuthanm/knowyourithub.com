import { readFile, writeFile } from "node:fs/promises";
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

function maskDbUrl(url) {
  if (!url) return "<missing>";
  try {
    const parsed = new URL(url);
    const user = parsed.username ? "***" : "";
    const password = parsed.password ? ":***" : "";
    return `${parsed.protocol}//${user}${password}@${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "postgresql://***:***@host/db";
  }
}

const companiesJsonPath = resolve(process.cwd(), "data", "companies.json");

console.log(`Using configured PostgreSQL connection: ${maskDbUrl(dbUrl)}`);
console.log("Processing temporary researched-profile input from data/companies.json");

async function clearCompanyDrafts() {
  await writeFile(companiesJsonPath, JSON.stringify({ companies: [] }, null, 2) + "\n", "utf8");
}

function normalizeStatus(value) {
  if (value === "verified" || value === "in_progress" || value === "unverified") return value;
  return "unverified";
}

function normalizeSecret(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function isMailerConfigured() {
  const host = normalizeSecret(process.env.SMTP_HOST);
  const user = normalizeSecret(process.env.SMTP_USER);
  const pass = normalizeSecret(process.env.SMTP_PASS);
  const configured = Boolean(host && user && pass && !host.includes("replace") && !user.includes("your@gmail.com") && !pass.includes("replace"));
  console.log(
    configured
      ? `SMTP mailer configured for host=${host} user=${user}`
      : "SMTP mailer not configured; email notifications will be skipped."
  );
  return configured;
}

function getTransport() {
  const host = normalizeSecret(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const user = normalizeSecret(process.env.SMTP_USER);
  const pass = normalizeSecret(process.env.SMTP_PASS);
  if (!host || !user || !pass) {
    console.warn("SMTP transport skipped because host/user/password are missing.");
    return null;
  }
  console.log(`Creating SMTP transport for ${host}:${port} as ${user}`);
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

const raw = await readFile(companiesJsonPath, "utf8");
const catalog = JSON.parse(raw);
if (!catalog || !Array.isArray(catalog.companies)) {
  throw new Error("Company data file must contain companies[] array");
}

const companies = catalog.companies;
if (companies.length === 0) {
  console.log("No companies found in source file. Skipping sync.");
  process.exit(0);
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
      if (verificationStatus === "unverified") continue;

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

    // Simple approach: For each company in the catalog, find and update matching submissions
    for (const company of companies) {
      const slug = String(company.slug || "").trim();
      const name = String(company.name || "").trim();
      const targetStatus = normalizeStatus(company.verificationStatus);
      
      if (!slug || !name || targetStatus === "unverified") continue;

      // Find submissions by slug OR by name (case-insensitive)
      const matchingSubmissions = await tx`
        SELECT id, company_name, company_slug, submitter_name, submitter_email, status
        FROM company_submissions
        WHERE (
          company_slug = ${slug}
          OR LOWER(company_name) ILIKE LOWER(${name})
        )
        AND status != ${targetStatus}
      `;

      for (const submission of matchingSubmissions) {
        if (targetStatus === "verified") {
          await tx`DELETE FROM company_submissions WHERE id = ${submission.id}`;
          newlyVerified.push({
            companyName: String(submission.company_name || "").trim(),
            companySlug: String(submission.company_slug || "").trim(),
            submitterName: String(submission.submitter_name || "").trim(),
            submitterEmail: String(submission.submitter_email || "").trim(),
          });
          console.log(`✓ Verified: ${submission.company_name}`);
        } else if (targetStatus === "in_progress") {
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
          console.log(`✓ In Progress: ${submission.company_name}`);
        }
      }
    }
  });

  if (newlyVerified.length > 0 && isMailerConfigured()) {
    let subscribers = [];
    try {
      subscribers = await sql`
        SELECT email
        FROM catalog_subscribers
        ORDER BY created_at DESC
        LIMIT 300
      `;
    } catch (error) {
      console.warn("Subscriber table unavailable for verified-email broadcast.", error instanceof Error ? error.message : error);
    }

    if (subscribers.length === 0) {
      console.log("No subscriber emails found; verified notification was skipped.");
    }

    {
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
            console.log(`Sending verified subscriber email to ${to} for ${company.companyName}`);
            const fromAddress = (process.env.MAIL_FROM || "").trim() || `"Know Your IT Hub" <${process.env.SMTP_USER}>`;
            try {
              await transport.sendMail({
                from: fromAddress,
                to,
                subject,
                text,
                html: `<p><strong>${company.companyName}</strong> moved to <strong>Verified</strong>.</p><p>A company request completed review and is now verified in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
              console.log(`Verified subscriber email sent to ${to}`);
            } catch (error) {
              console.error(`Failed to send verified subscriber notification to ${to}:`, error instanceof Error ? error.message : error);
            }
          }

          const requesterEmail = String(company.submitterEmail || "").trim().toLowerCase();
          const requesterName = company.submitterName || "there";
          const requesterDedupKey = `${requesterEmail}|${company.companySlug || company.companyName}`;
          if (isValidEmail(requesterEmail) && !requesterSent.has(requesterDedupKey)) {
            requesterSent.add(requesterDedupKey);
            console.log(`Sending verified requester email to ${requesterEmail} for ${company.companyName}`);
            const fromAddress = (process.env.MAIL_FROM || "").trim() || `"Know Your IT Hub" <${process.env.SMTP_USER}>`;
            try {
              await transport.sendMail({
                from: fromAddress,
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
              console.log(`Verified requester email sent to ${requesterEmail}`);
            } catch (error) {
              console.error(`Failed to send verified requester notification to ${requesterEmail}:`, error instanceof Error ? error.message : error);
            }
          }
        }
      }
    }
  }

  if (newlyInProgress.length > 0 && isMailerConfigured()) {
    let subscribers = [];
    try {
      subscribers = await sql`
        SELECT email
        FROM catalog_subscribers
        ORDER BY created_at DESC
        LIMIT 300
      `;
    } catch (error) {
      console.warn("Subscriber table unavailable for in-progress email update.", error instanceof Error ? error.message : error);
    }

    if (subscribers.length === 0) {
      console.log("No subscriber emails found; in-progress notification was skipped.");
    }

    {
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
            console.log(`Sending in-progress subscriber email to ${to} for ${company.companyName}`);
            const fromAddress = (process.env.MAIL_FROM || "").trim() || `"Know Your IT Hub" <${process.env.SMTP_USER}>`;
            try {
              await transport.sendMail({
                from: fromAddress,
                to,
                subject,
                text,
                html: `<p><strong>${company.companyName}</strong> moved to <strong>In Progress</strong>.</p><p>A company request is now under review in the catalog.</p><p><a href="${site}/coming-soon">Open review queue</a></p><p><a href="${site}${profilePath}">View profile</a></p>`,
              });
              console.log(`In-progress subscriber email sent to ${to}`);
            } catch (error) {
              console.error(`Failed to send in-progress subscriber notification to ${to}:`, error instanceof Error ? error.message : error);
            }
          }

          const requesterEmail = String(company.submitterEmail || "").trim().toLowerCase();
          const requesterName = company.submitterName || "there";
          const requesterDedupKey = `${requesterEmail}|${company.companySlug || company.companyName}`;
          if (isValidEmail(requesterEmail) && !requesterSent.has(requesterDedupKey)) {
            requesterSent.add(requesterDedupKey);
            console.log(`Sending in-progress requester email to ${requesterEmail} for ${company.companyName}`);
            const fromAddress = (process.env.MAIL_FROM || "").trim() || `"Know Your IT Hub" <${process.env.SMTP_USER}>`;
            try {
              await transport.sendMail({
                from: fromAddress,
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
              console.log(`In-progress requester email sent to ${requesterEmail}`);
            } catch (error) {
              console.error(`Failed to send in-progress requester notification to ${requesterEmail}:`, error instanceof Error ? error.message : error);
            }
          }
        }
      }
    }
  }

  console.log(`Synced ${companies.length} companies to company_profiles.`);
  console.log(`Updated ${newlyVerified.length} submissions to verified.`);
  console.log(`Updated ${newlyInProgress.length} submissions to in_progress.`);
  await clearCompanyDrafts();
  console.log("Cleared temporary data/companies.json entries after a successful sync.");
} finally {
  await sql.end({ timeout: 5 });
}
