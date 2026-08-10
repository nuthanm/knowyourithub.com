import { corsPreflightResponse, jsonResponse } from "@/lib/api/cors";
import { createQueueModerationToken } from "@/lib/security/queue-token";

function isValidPasscode(passcode: string) {
  const configured = process.env.REVIEW_QUEUE_PASSCODE?.trim() || process.env.ADMIN_API_KEY?.trim();
  if (!configured) return false;
  return passcode === configured;
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

  const passcode =
    typeof (body as { passcode?: unknown })?.passcode === "string"
      ? (body as { passcode: string }).passcode.trim()
      : "";

  if (!passcode || !isValidPasscode(passcode)) {
    return jsonResponse({ ok: false, error: "Invalid passcode." }, request, { status: 401 });
  }

  const token = createQueueModerationToken(8 * 60 * 60 * 1000);
  return jsonResponse({ ok: true, token }, request);
}
