import { corsPreflightResponse, jsonResponse } from "@/lib/api/cors";
import { updateSubmissionQueueStatus, type SubmissionQueueStatus } from "@/lib/submissions";
import { verifyQueueModerationToken } from "@/lib/security/queue-token";

const ALLOWED_STATUSES = new Set<SubmissionQueueStatus>([
  "awaiting_review",
  "in_progress",
  "rejected",
]);

function readAdminKey(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const explicit = request.headers.get("x-admin-key")?.trim();
  return bearer || explicit || "";
}

function hasValidAdminKey(request: Request) {
  const configured = process.env.ADMIN_API_KEY?.trim();
  if (!configured) return false;
  const provided = readAdminKey(request);
  return Boolean(provided) && provided === configured;
}

function hasValidModeratorToken(request: Request, submissionId: string) {
  const token = request.headers.get("x-moderator-token")?.trim();
  const payload = verifyQueueModerationToken(token);
  return Boolean(payload && (!payload.submissionId || payload.submissionId === submissionId));
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, request, { status: 400 });
  }

  const id = typeof (body as { id?: unknown })?.id === "string"
    ? (body as { id: string }).id.trim()
    : "";
  const status = typeof (body as { status?: unknown })?.status === "string"
    ? (body as { status: string }).status.trim()
    : "";
  const companyName = typeof (body as { companyName?: unknown })?.companyName === "string"
    ? (body as { companyName: string }).companyName.trim()
    : undefined;
  const companySlug = typeof (body as { companySlug?: unknown })?.companySlug === "string"
    ? (body as { companySlug: string }).companySlug.trim()
    : undefined;

  if (!id) {
    return jsonResponse({ ok: false, error: "Submission id is required." }, request, { status: 400 });
  }

  if (!hasValidAdminKey(request) && !hasValidModeratorToken(request, id)) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, request, { status: 401 });
  }

  if (!ALLOWED_STATUSES.has(status as SubmissionQueueStatus)) {
    return jsonResponse(
      { ok: false, error: "Status must be one of awaiting_review, in_progress, rejected." },
      request,
      { status: 400 },
    );
  }

  try {
    const result = await updateSubmissionQueueStatus({
      id,
      status: status as SubmissionQueueStatus,
      companyName,
      companySlug,
    });

    if (!result.updated) {
      if (result.reason === "not-found") {
        return jsonResponse({ ok: false, error: "Submission not found." }, request, { status: 404 });
      }
      return jsonResponse({ ok: false, error: "Unable to update status." }, request, { status: 500 });
    }

    return jsonResponse({ ok: true, item: result }, request);
  } catch {
    return jsonResponse({ ok: false, error: "Unable to update queue status." }, request, { status: 500 });
  }
}
