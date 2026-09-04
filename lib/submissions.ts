import postgres from "postgres";
import {
  slugifyCompanyName,
} from "./companies";
import { buildAdminEmail, buildUserConfirmationEmail } from "./email-templates";
import { buildQueueStageBroadcastEmail, buildSubmissionRejectedEmail } from "./email-templates";
import { isMailerConfigured, sendMail } from "./security/mailer";
import {
  queueStatusToSearchStatus,
  type QueueSubmissionItem,
  type SubmissionQueueStatus,
} from "./submissions-shared";
import { listSubscribers } from "./subscribers";
import type { SubmissionInput } from "./validators";
import { getQueueStageNotificationTarget } from "./email-templates";
import { loadServerEnv } from "./server-env";

let sql: ReturnType<typeof postgres> | null = null;

function normalizeCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function normalizeCompanyIdentity(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llp|incorporated|inc|corp|corporation|plc)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getCompanyIdentitySql(column: string) {
  return `regexp_replace(regexp_replace(lower(${column}), '\\m(private|pvt|limited|ltd|llp|incorporated|inc|corp|corporation|plc)\\M\\.?', '', 'g'), '[^a-z0-9]+', '', 'g')`;
}

function splitCompanyNameTokens(value: string) {
  return value
    .replace(/&/g, " and ")
    .split(/[\s/-]+/)
    .flatMap((part) => part.match(/[A-Z]{2,}(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|[0-9]+/g) ?? [])
    .filter(Boolean);
}

function getAcronymToken(part: string) {
  const trimmed = part.trim();
  if (!trimmed) return "";

  const uppercasePrefix = trimmed.match(/^[A-Z0-9]{2,}(?=[a-z]|$)/)?.[0];
  if (uppercasePrefix) return uppercasePrefix;

  return trimmed[0] ?? "";
}

function getWebsiteHostKey(url?: string) {
  if (!url) return "";
  try {
    return normalizeCompanyKey(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return "";
  }
}

function getCompanyAliasKeys(name: string, slug: string, website?: string) {
  const keys = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    const normalized = normalizeCompanyKey(value);
    if (normalized) keys.add(normalized);
  };

  add(name);
  add(slug);
  add(getWebsiteHostKey(website));
  add(normalizeCompanyIdentity(name));
  add(normalizeCompanyIdentity(slug));

  const tokens = splitCompanyNameTokens(name);
  if (tokens.length > 1) {
    add(tokens.map((token) => (/^[A-Z0-9]{2,}$/.test(token) ? token : token[0])).join(""));
    add(tokens.map((token) => token[0]).join(""));
  }

  const parts = name.replace(/&/g, " and ").split(/[\s/-]+/).filter(Boolean);
  if (parts.length > 1) {
    add(parts.map(getAcronymToken).join(""));
  }

  return keys;
}

const ACTIVE_QUEUE_STATUSES: SubmissionQueueStatus[] = ["awaiting_review", "in_progress"];

export type ExistingCompanyStatus = "verified" | "awaiting_review" | "in_progress";

function mapDbSubmissionStatus(value?: string | null): SubmissionQueueStatus {
  if (value === "in_progress") return "in_progress";
  if (value === "verified") return "verified";
  if (value === "rejected") return "rejected";
  // Backward compatibility with old schema/status value.
  if (value === "pending") return "awaiting_review";
  return "awaiting_review";
}

function getSql() {
  loadServerEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("replace") || url.includes("user:password")) return null;
  if (!sql) sql = postgres(url, { max: 1, prepare: false });
  return sql;
}

export function resolveSubmissionSlug(input: Pick<SubmissionInput, "companySlug" | "companyName">) {
  const slug = input.companySlug?.trim() || slugifyCompanyName(input.companyName);
  return slug || "unknown";
}

export function isDatabaseConfigured() {
  return Boolean(getSql());
}

function summarizeMessage(message: string, max = 120) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildQueueNote(input: Pick<SubmissionInput, "requestType" | "message" | "isPortalRequest">) {
  const summary = summarizeMessage(input.message);
  const source = input.isPortalRequest ? "Portal" : "Mail";
  if (input.requestType === "edit") {
    return `${source} edit request — ${summary}`;
  }
  return `${source} request — ${summary}`;
}

type SubscriberNotificationResult = {
  configured: boolean;
  recipients: number;
  delivered: number;
  failed: number;
};

type RequesterNotificationResult = {
  configured: boolean;
  delivered: boolean;
  failed: boolean;
};

async function notifySubscribersOnQueueStageChange(params: {
  companyName: string;
  companySlug?: string;
  stage: Exclude<SubmissionQueueStatus, "rejected">;
  submitterEmail?: string;
  submitterName?: string;
}): Promise<SubscriberNotificationResult> {
  try {
    if (!isMailerConfigured()) {
      return { configured: false, recipients: 0, delivered: 0, failed: 0 };
    }

    const target = getQueueStageNotificationTarget(params.stage, params.submitterEmail);
    if (target.mode === "none") {
      return { configured: true, recipients: 0, delivered: 0, failed: 0 };
    }

    const mail = buildQueueStageBroadcastEmail({
      companyName: params.companyName,
      companySlug: params.companySlug,
      stage: params.stage,
    });

    if (target.mode === "submitter") {
      const recipient = target.recipients[0];
      if (!recipient) {
        return { configured: true, recipients: 0, delivered: 0, failed: 0 };
      }
      try {
        await sendMail({ to: recipient, ...mail });
        return { configured: true, recipients: 1, delivered: 1, failed: 0 };
      } catch {
        return { configured: true, recipients: 1, delivered: 0, failed: 1 };
      }
    }

    const subscribers = await listSubscribers(300);
    if (!subscribers.length) {
      return { configured: true, recipients: 0, delivered: 0, failed: 0 };
    }

    const recipients = subscribers
      .map((subscriber) => subscriber.email?.trim())
      .filter((email): email is string => Boolean(email));

    const results = await Promise.allSettled(recipients.map((to) => sendMail({ to, ...mail })));
    const delivered = results.filter((result) => result.status === "fulfilled").length;
    return { configured: true, recipients: recipients.length, delivered, failed: recipients.length - delivered };
  } catch {
    // Status changes must succeed even if subscriber lookup/mail delivery fails.
    return { configured: isMailerConfigured(), recipients: 0, delivered: 0, failed: 1 };
  }
}

async function notifyRequesterOfRejectedSubmission(params: {
  companyName: string;
  submitterName: string;
  submitterEmail: string;
}): Promise<RequesterNotificationResult> {
  if (!isMailerConfigured()) {
    return { configured: false, delivered: false, failed: false };
  }

  try {
    const mail = buildSubmissionRejectedEmail({
      companyName: params.companyName,
      submitterName: params.submitterName,
    });
    await sendMail({ to: params.submitterEmail, ...mail });
    return { configured: true, delivered: true, failed: false };
  } catch {
    return { configured: true, delivered: false, failed: true };
  }
}

export async function saveSubmission(input: SubmissionInput & { id: string }) {
  const db = getSql();
  if (!db) return { stored: false as const };
  await db`
    INSERT INTO company_submissions (
      id, request_type, company_name, company_slug, website,
      submitter_name, submitter_email, message, is_portal_request
    ) VALUES (
      ${input.id},
      ${input.requestType},
      ${input.companyName},
      ${input.companySlug || null},
      ${input.website || null},
      ${input.submitterName},
      ${input.submitterEmail},
      ${input.message},
      ${input.isPortalRequest}
    )
    ON CONFLICT (id) DO UPDATE SET
      request_type = EXCLUDED.request_type,
      company_name = EXCLUDED.company_name,
      company_slug = EXCLUDED.company_slug,
      website = EXCLUDED.website,
      message = EXCLUDED.message,
      is_portal_request = EXCLUDED.is_portal_request,
      status = 'awaiting_review',
      updated_at = NOW()
  `;
  return { stored: true as const };
}

function queueItemsMatch(left: QueueSubmissionItem, right: QueueSubmissionItem) {
  const leftKeys = getCompanyAliasKeys(left.name, left.slug, left.website);
  const rightKeys = getCompanyAliasKeys(right.name, right.slug, right.website);
  return [...leftKeys].some((key) => rightKeys.has(key));
}

async function findActiveQueueSubmission(item: QueueSubmissionItem) {
  const db = getSql();
  const candidates: QueueSubmissionItem[] = [];

  if (db) {
    const rows = await db<
      Array<{
        id: string;
        request_type: "add" | "edit";
        status: string;
        company_name: string;
        company_slug: string | null;
        website: string | null;
        message: string;
        is_portal_request: boolean;
        created_at: Date;
      }>
    >`
      SELECT id, request_type, status, company_name, company_slug, website, message, is_portal_request, created_at
      FROM company_submissions
      WHERE status = ANY(${ACTIVE_QUEUE_STATUSES})
      ORDER BY created_at DESC
      LIMIT 200
    `;

    candidates.push(
      ...rows.map((row) => ({
        id: row.id,
        slug: row.company_slug?.trim() || slugifyCompanyName(row.company_name),
        name: row.company_name.trim(),
        requestType: row.request_type,
        isPortalRequest: row.is_portal_request,
        queueStatus: mapDbSubmissionStatus(row.status),
        note: buildQueueNote({ requestType: row.request_type, message: row.message, isPortalRequest: row.is_portal_request }),
        submittedAt: row.created_at.toISOString(),
        website: row.website?.trim() || undefined,
      })),
    );
  }

  return candidates.find(
    (candidate) =>
      ACTIVE_QUEUE_STATUSES.includes(candidate.queueStatus ?? "awaiting_review") &&
      queueItemsMatch(candidate, item),
  );
}

async function findCompanyProfile(input: Pick<SubmissionInput, "companyName" | "companySlug">) {
  const db = getSql();
  if (!db) return null;

  const identity = normalizeCompanyIdentity(input.companyName);
  const rows = await db<
    Array<{ slug: string; name: string; verification_status: string }>
  >`
    SELECT slug, name, verification_status
    FROM company_profiles
    WHERE ${db.unsafe(getCompanyIdentitySql("slug"))} = ${identity}
      OR ${db.unsafe(getCompanyIdentitySql("name"))} = ${identity}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getCompanyAvailability(companyName: string) {
  const db = getSql();
  const identity = normalizeCompanyIdentity(companyName);
  if (!db || !identity) return { available: false as const, reason: "unavailable" as const };

  const profiles = await db<Array<{ name: string; verification_status: string }>>`
    SELECT name, verification_status
    FROM company_profiles
    WHERE ${db.unsafe(getCompanyIdentitySql("slug"))} = ${identity}
      OR ${db.unsafe(getCompanyIdentitySql("name"))} = ${identity}
    LIMIT 1
  `;
  const profile = profiles[0];
  if (profile) {
    return { available: false as const, reason: "profile" as const, name: profile.name, status: profile.verification_status };
  }

  const submissions = await db<Array<{ company_name: string; status: SubmissionQueueStatus }>>`
    SELECT company_name, status
    FROM company_submissions
    WHERE status = ANY(${ACTIVE_QUEUE_STATUSES})
      AND (
        ${db.unsafe(getCompanyIdentitySql("company_name"))} = ${identity}
        OR ${db.unsafe(getCompanyIdentitySql("company_slug"))} = ${identity}
      )
    LIMIT 1
  `;
  const submission = submissions[0];
  if (submission) {
    return { available: false as const, reason: "queue" as const, name: submission.company_name, status: submission.status };
  }

  return { available: true as const };
}

export async function enqueueSubmissionFromMail(
  input: SubmissionInput & { id: string },
): Promise<{
  stored: boolean;
  duplicate: boolean;
  alreadyInCatalog: boolean;
  existingStatus?: ExistingCompanyStatus;
  item: QueueSubmissionItem;
}> {
  const slug = resolveSubmissionSlug(input);
  const item: QueueSubmissionItem = {
    id: input.id,
    slug,
    name: input.companyName.trim(),
    submitterName: input.submitterName?.trim() || undefined,
    submitterEmail: input.submitterEmail?.trim() || undefined,
    requestType: input.requestType,
    isPortalRequest: input.isPortalRequest,
    queueStatus: "awaiting_review",
    note: buildQueueNote(input),
    submittedAt: new Date().toISOString(),
    website: input.website?.trim() || undefined,
  };

  const catalogCompany = input.requestType === "add" ? await findCompanyProfile(input) : null;
  if (catalogCompany) {
    const existingStatus = catalogCompany.verification_status === "verified"
      ? "verified"
      : catalogCompany.verification_status === "in_progress"
        ? "in_progress"
        : "awaiting_review";
    return {
      stored: true,
      duplicate: true,
      alreadyInCatalog: true,
      existingStatus,
      item: {
        ...item,
        name: catalogCompany.name,
        slug: catalogCompany.slug,
      },
    };
  }

  const existing = await findActiveQueueSubmission(item);
  if (existing) {
    const existingStatus: ExistingCompanyStatus = existing.queueStatus === "in_progress"
      ? "in_progress"
      : "awaiting_review";
    return {
      stored: true,
      duplicate: true,
      alreadyInCatalog: false,
      existingStatus,
      item: existing,
    };
  }

  const dbResult = await saveSubmission(input);

  return {
    stored: dbResult.stored,
    duplicate: false,
    alreadyInCatalog: false,
    item,
  };
}

export async function listQueueSubmissions(submissionId?: string) {
  const db = getSql();
  const dbItems: QueueSubmissionItem[] = [];

  if (db) {
    const rows = await db<
      Array<{
        id: string;
        request_type: "add" | "edit";
        status: string;
        company_name: string;
        company_slug: string | null;
        website: string | null;
        message: string;
        is_portal_request: boolean;
        created_at: Date;
      }>
    >`
      SELECT id, request_type, status, company_name, company_slug, website, message, is_portal_request, created_at
      FROM company_submissions
      WHERE status = ANY(${ACTIVE_QUEUE_STATUSES})
        AND (${submissionId ?? null}::text IS NULL OR id = ${submissionId ?? null})
      ORDER BY created_at DESC
      LIMIT 200
    `;

    for (const row of rows) {
      const slug = row.company_slug?.trim() || slugifyCompanyName(row.company_name);
      const input = {
        requestType: row.request_type,
        companyName: row.company_name,
        companySlug: slug,
        message: row.message,
        isPortalRequest: row.is_portal_request,
      } as SubmissionInput;

      dbItems.push({
        id: row.id,
        slug,
        name: row.company_name.trim(),
        requestType: row.request_type,
        isPortalRequest: row.is_portal_request,
        queueStatus: mapDbSubmissionStatus(row.status),
        note: buildQueueNote(input),
        submittedAt: row.created_at.toISOString(),
        website: row.website?.trim() || undefined,
      });
    }
  }

  return dbItems.filter((item) => item.slug && item.slug !== "unknown");

}

export async function updateSubmissionQueueStatus(input: {
  id: string;
  status: SubmissionQueueStatus;
  companyName?: string;
  companySlug?: string;
}) {
  const db = getSql();
  if (!db) {
    return { updated: false as const, reason: "unavailable" as const };
  }

  const rows = await db<
    Array<{
      id: string;
      company_name: string;
      company_slug: string | null;
      submitter_name: string;
      submitter_email: string;
      status: string;
      previous_status: string;
    }>
  >`
    WITH target AS (
      SELECT id, company_name, company_slug, submitter_name, submitter_email, status
      FROM company_submissions
      WHERE id = ${input.id}
      LIMIT 1
    )
    UPDATE company_submissions AS submissions
    SET status = ${input.status}, updated_at = NOW()
    FROM target
    WHERE submissions.id = target.id
    RETURNING submissions.id, submissions.company_name, submissions.company_slug, submissions.submitter_name, submissions.submitter_email, submissions.status, target.status AS previous_status
  `;

  const row = rows[0];
  if (!row) return { updated: false as const, reason: "not-found" as const };

  const nextStatus = mapDbSubmissionStatus(row.status);
  const previousStatus = mapDbSubmissionStatus(row.previous_status);
  const changed = previousStatus !== nextStatus;
  const resolvedSlug = input.companySlug?.trim() || row.company_slug || undefined;

  const effectiveSlug = resolvedSlug || slugifyCompanyName(row.company_name);
  const effectiveName = input.companyName?.trim() || row.company_name;

  const subscriberNotification = changed && nextStatus !== "rejected"
    ? await notifySubscribersOnQueueStageChange({
      companyName: effectiveName,
      companySlug: effectiveSlug,
      stage: nextStatus,
      submitterEmail: row.submitter_email,
      submitterName: row.submitter_name,
    })
    : undefined;
  const requesterNotification = changed && nextStatus === "rejected"
    ? await notifyRequesterOfRejectedSubmission({
      companyName: effectiveName,
      submitterName: row.submitter_name,
      submitterEmail: row.submitter_email,
    })
    : undefined;

  return {
    updated: true as const,
    id: row.id,
    companyName: effectiveName,
    companySlug: effectiveSlug,
    status: nextStatus,
    previousStatus,
    changed,
    subscriberNotification,
    requesterNotification,
  };
}

export { buildAdminEmail, buildUserConfirmationEmail };
export { queueStatusToSearchStatus, type QueueSubmissionItem, type SubmissionQueueStatus };
