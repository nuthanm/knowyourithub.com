import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type QueueAcceptPayload = {
  id: string;
  companyName: string;
  companySlug?: string;
  website?: string;
  requestType: "add" | "edit";
  message: string;
  submitterName: string;
  submitterEmail: string;
};

export type QueueModerationPayload = {
  role: "moderator";
  submissionId?: string;
  exp: number;
};

function signingSecret() {
  return (
    process.env.ADMIN_API_KEY?.trim() ||
    process.env.CAPTCHA_SECRET?.trim() ||
    "dev-queue-secret"
  );
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createQueueAcceptToken(payload: QueueAcceptPayload) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt }), "utf8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyQueueAcceptToken(token?: string | null): QueueAcceptPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QueueAcceptPayload & {
      exp?: number;
    };
    if (!parsed?.id || !parsed.companyName || !parsed.requestType || !parsed.message) return null;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return {
      id: parsed.id,
      companyName: parsed.companyName,
      companySlug: parsed.companySlug,
      website: parsed.website,
      requestType: parsed.requestType,
      message: parsed.message,
      submitterName: parsed.submitterName || "Email approval",
      submitterEmail: parsed.submitterEmail || "noreply@knowyourithub.com",
    };
  } catch {
    return null;
  }
}

/** Short-lived banner token — proves the visitor came from the mail accept link. */
export function createMailBannerToken(
  companyName: string,
  id: string,
  outcome: "added" | "already_queued" = "added",
) {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const body = Buffer.from(JSON.stringify({ companyName, id, outcome, exp: expiresAt }), "utf8").toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

export function verifyMailBannerToken(
  token?: string | null,
): { companyName: string; id: string; outcome: "added" | "already_queued" } | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      companyName?: string;
      id?: string;
      outcome?: unknown;
      exp?: number;
    };
    if (!parsed.companyName || !parsed.id || !parsed.exp || Date.now() > parsed.exp) return null;
    return {
      companyName: parsed.companyName,
      id: parsed.id,
      outcome: parsed.outcome === "already_queued" ? "already_queued" : "added",
    };
  } catch {
    return null;
  }
}

/** No-login moderation token for queue status updates from trusted email links. */
export function createQueueModerationToken(submissionId?: string, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const body = Buffer.from(
    JSON.stringify({ role: "moderator", submissionId, exp: Date.now() + ttlMs } satisfies QueueModerationPayload),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyQueueModerationToken(token?: string | null): QueueModerationPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QueueModerationPayload;
    if (parsed.role !== "moderator" || (parsed.submissionId !== undefined && !parsed.submissionId)) return null;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return { role: parsed.role, submissionId: parsed.submissionId, exp: parsed.exp };
  } catch {
    return null;
  }
}
