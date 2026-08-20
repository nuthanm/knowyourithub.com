import postgres from "postgres";
import {
  ALL_COMPANY_SLUGS,
  PIPELINE_IN_PROGRESS,
  PIPELINE_UNVERIFIED,
  slugifyCompanyName,
  VERIFIED_COMPANIES,
} from "./companies";
import { buildAdminEmail, buildUserConfirmationEmail } from "./email-templates";
import { buildQueueStageBroadcastEmail } from "./email-templates";
import { isMailerConfigured, sendMail } from "./security/mailer";
import {
  queueStatusToSearchStatus,
  type QueueSubmissionItem,
  type SubmissionQueueStatus,
} from "./submissions-shared";
import { listSubscribers } from "./subscribers";
import type { SubmissionInput } from "./validators";

let sql: ReturnType<typeof postgres> | null = null;

const STATIC_PIPELINE_SLUGS = new Set([
  ...PIPELINE_IN_PROGRESS.map((item) => item.slug),
  ...PIPELINE_UNVERIFIED.map((item) => item.slug),
]);

function normalizeCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
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

const VERIFIED_SLUGS = new Set(VERIFIED_COMPANIES.map((company) => company.slug));

const ACTIVE_QUEUE_STATUSES: SubmissionQueueStatus[] = ["awaiting_review", "in_progress"];

function mapDbSubmissionStatus(value?: string | null): SubmissionQueueStatus {
  if (value === "in_progress") return "in_progress";
  if (value === "verified") return "verified";
  if (value === "rejected") return "rejected";
  // Backward compatibility with old schema/status value.
  if (value === "pending") return "awaiting_review";
  return "awaiting_review";
}

function getSql() {
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

function buildQueueNote(input: Pick<SubmissionInput, "requestType" | "message">) {
  const summary = summarizeMessage(input.message);
  if (input.requestType === "edit") {
    return `Community edit request — ${summary}`;
  }
  return `Community request — ${summary}`;
}

type SubscriberNotificationResult = {
  configured: boolean;
  recipients: number;
  delivered: number;
  failed: number;
};

async function notifySubscribersOnQueueStageChange(params: {
  companyName: string;
  companySlug?: string;
  stage: Exclude<SubmissionQueueStatus, "rejected">;
}): Promise<SubscriberNotificationResult> {
  try {
    if (!isMailerConfigured()) {
      return { configured: false, recipients: 0, delivered: 0, failed: 0 };
    }
    const subscribers = await listSubscribers(300);
    if (!subscribers.length) {
      return { configured: true, recipients: 0, delivered: 0, failed: 0 };
    }

    const mail = buildQueueStageBroadcastEmail({
      companyName: params.companyName,
      companySlug: params.companySlug,
      stage: params.stage,
    });

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

export async function saveSubmission(input: SubmissionInput & { id: string }) {
  const db = getSql();
  if (!db) return { stored: false as const };
  await db`
    INSERT INTO company_submissions (
      id, request_type, company_name, company_slug, website,
      submitter_name, submitter_email, message
    ) VALUES (
      ${input.id},
      ${input.requestType},
      ${input.companyName},
      ${input.companySlug || null},
      ${input.website || null},
      ${input.submitterName},
      ${input.submitterEmail},
      ${input.message}
    )
    ON CONFLICT (id) DO UPDATE SET
      request_type = EXCLUDED.request_type,
      company_name = EXCLUDED.company_name,
      company_slug = EXCLUDED.company_slug,
      website = EXCLUDED.website,
      message = EXCLUDED.message,
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
        created_at: Date;
      }>
    >`
      SELECT id, request_type, status, company_name, company_slug, website, message, created_at
      FROM company_submissions
      WHERE status = ANY(${ACTIVE_QUEUE_STATUSES}) OR status = 'pending'
      ORDER BY created_at DESC
      LIMIT 200
    `;

    candidates.push(
      ...rows.map((row) => ({
        id: row.id,
        slug: row.company_slug?.trim() || slugifyCompanyName(row.company_name),
        name: row.company_name.trim(),
        requestType: row.request_type,
        queueStatus: mapDbSubmissionStatus(row.status),
        note: buildQueueNote({ requestType: row.request_type, message: row.message }),
        submittedAt: row.created_at.toISOString(),
        website: row.website?.trim() || undefined,
      })),
    );
  }

  const { readPendingQueueJson } = await import("@/lib/pending-queue-store");
  candidates.push(...(await readPendingQueueJson()));

  return candidates.find(
    (candidate) =>
      ACTIVE_QUEUE_STATUSES.includes(candidate.queueStatus ?? "awaiting_review") &&
      queueItemsMatch(candidate, item),
  );
}

export async function enqueueSubmissionFromMail(
  input: SubmissionInput & { id: string },
): Promise<{ stored: boolean; duplicate: boolean; item: QueueSubmissionItem }> {
  const slug = resolveSubmissionSlug(input);
  const item: QueueSubmissionItem = {
    id: input.id,
    slug,
    name: input.companyName.trim(),
    requestType: input.requestType,
    queueStatus: "awaiting_review",
    note: buildQueueNote(input),
    submittedAt: new Date().toISOString(),
    website: input.website?.trim() || undefined,
  };

  const existing = await findActiveQueueSubmission(item);
  if (existing) {
    return { stored: true, duplicate: true, item: existing };
  }

  const dbResult = await saveSubmission(input);
  const { upsertPendingQueueJson } = await import("@/lib/pending-queue-store");
  const jsonResult = await upsertPendingQueueJson(item);

  return { stored: dbResult.stored || jsonResult.stored, duplicate: false, item };
}

export async function listQueueSubmissions() {
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
        created_at: Date;
      }>
    >`
      SELECT id, request_type, status, company_name, company_slug, website, message, created_at
      FROM company_submissions
      WHERE status = ANY(${ACTIVE_QUEUE_STATUSES}) OR status = 'pending'
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
      } as SubmissionInput;

      dbItems.push({
        id: row.id,
        slug,
        name: row.company_name.trim(),
        requestType: row.request_type,
        queueStatus: mapDbSubmissionStatus(row.status),
        note: buildQueueNote(input),
        submittedAt: row.created_at.toISOString(),
        website: row.website?.trim() || undefined,
      });
    }
  }

  const { readPendingQueueJson } = await import("@/lib/pending-queue-store");
  const jsonItems = await readPendingQueueJson();

  const seen = new Set<string>();
  const merged = [...dbItems, ...jsonItems].filter((item) => {
    if (!item.slug || item.slug === "unknown") return false;
    if (
      item.requestType === "edit" &&
      !STATIC_PIPELINE_SLUGS.has(item.slug) &&
      !ALL_COMPANY_SLUGS.includes(item.slug)
    ) {
      return false;
    }
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return merged;
}

export async function updateSubmissionQueueStatus(input: {
  id: string;
  status: SubmissionQueueStatus;
  companyName?: string;
  companySlug?: string;
}) {
  const db = getSql();
  if (!db) {
    const { readPendingQueueJson, removePendingQueueJsonEntries, setPendingQueueJsonStatus } = await import(
      "@/lib/pending-queue-store"
    );

    const items = await readPendingQueueJson();
    const found = items.find(
      (item) => item.id === input.id || (!!input.companySlug && item.slug === input.companySlug),
    );

    if (!found) return { updated: false as const, reason: "not-found" as const };

    const previousStatus = found.queueStatus ?? "awaiting_review";
    const changed = previousStatus !== input.status;

    if (input.status === "verified" || input.status === "rejected") {
      await removePendingQueueJsonEntries({ id: found.id, slug: found.slug });
    } else {
      await setPendingQueueJsonStatus({
        id: found.id,
        slug: found.slug,
        queueStatus: input.status,
      });
    }

    const { removeCatalogDraftBySlug, upsertInProgressCatalogDraft } = await import(
      "@/lib/catalog-drafts"
    );
    const effectiveSlug = input.companySlug?.trim() || found.slug;
    const effectiveName = input.companyName?.trim() || found.name;
    const effectiveWebsite = found.website;

    if (input.status === "in_progress" && !VERIFIED_SLUGS.has(effectiveSlug)) {
      await upsertInProgressCatalogDraft({
        slug: effectiveSlug,
        name: effectiveName,
        website: effectiveWebsite,
      });
    } else {
      await removeCatalogDraftBySlug(effectiveSlug);
    }

    const subscriberNotification = changed && input.status !== "rejected"
      ? await notifySubscribersOnQueueStageChange({
        companyName: effectiveName,
        companySlug: effectiveSlug,
        stage: input.status,
      })
      : undefined;

    return {
      updated: true as const,
      id: found.id,
      companyName: effectiveName,
      companySlug: effectiveSlug,
      status: input.status,
      previousStatus,
      changed,
      subscriberNotification,
    };
  }

  const rows = await db<
    Array<{
      id: string;
      company_name: string;
      company_slug: string | null;
      status: string;
      previous_status: string;
    }>
  >`
    WITH target AS (
      SELECT id, company_name, company_slug, status
      FROM company_submissions
      WHERE id = ${input.id}
      LIMIT 1
    )
    UPDATE company_submissions AS submissions
    SET status = ${input.status}, updated_at = NOW()
    FROM target
    WHERE submissions.id = target.id
    RETURNING submissions.id, submissions.company_name, submissions.company_slug, submissions.status, target.status AS previous_status
  `;

  const row = rows[0];
  if (!row) return { updated: false as const, reason: "not-found" as const };

  const nextStatus = mapDbSubmissionStatus(row.status);
  const previousStatus = mapDbSubmissionStatus(row.previous_status);
  const changed = previousStatus !== nextStatus;
  const resolvedSlug = input.companySlug?.trim() || row.company_slug || undefined;

  const { removePendingQueueJsonEntries, setPendingQueueJsonStatus } = await import(
    "@/lib/pending-queue-store"
  );

  if (nextStatus === "verified" || nextStatus === "rejected") {
    await removePendingQueueJsonEntries({ id: row.id, slug: resolvedSlug });
  } else {
    await setPendingQueueJsonStatus({
      id: row.id,
      slug: resolvedSlug,
      queueStatus: nextStatus,
    });
  }

  const { removeCatalogDraftBySlug, upsertInProgressCatalogDraft } = await import(
    "@/lib/catalog-drafts"
  );
  const effectiveSlug = resolvedSlug || slugifyCompanyName(row.company_name);
  const effectiveName = input.companyName?.trim() || row.company_name;

  if (nextStatus === "in_progress" && !VERIFIED_SLUGS.has(effectiveSlug)) {
    await upsertInProgressCatalogDraft({
      slug: effectiveSlug,
      name: effectiveName,
    });
  } else {
    await removeCatalogDraftBySlug(effectiveSlug);
  }

  const subscriberNotification = changed && nextStatus !== "rejected"
    ? await notifySubscribersOnQueueStageChange({
      companyName: effectiveName,
      companySlug: effectiveSlug,
      stage: nextStatus,
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
  };
}

export { buildAdminEmail, buildUserConfirmationEmail };
export { queueStatusToSearchStatus, type QueueSubmissionItem, type SubmissionQueueStatus };
