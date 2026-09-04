import { jsonResponse, corsPreflightResponse } from "@/lib/api/cors";
import { verifyMailBannerToken, verifyQueueModerationToken } from "@/lib/security/queue-token";
import { listQueueSubmissions } from "@/lib/submissions";

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bannerToken = url.searchParams.get("banner");
  const moderationToken = url.searchParams.get("moderate");
  const noStore = { headers: { "Cache-Control": "no-store" } };

  // Mail-only banner check: used by coming-soon to show "<Company> added in the queue"
  if (bannerToken) {
    const verified = verifyMailBannerToken(bannerToken);
    if (!verified) {
      return jsonResponse(
        { ok: false, error: "Banner token invalid or expired." },
        request,
        { status: 400, ...noStore },
      );
    }
    return jsonResponse(
      {
        ok: true,
        fromMail: true,
        companyName: verified.companyName,
        id: verified.id,
        outcome: verified.outcome,
      },
      request,
      noStore,
    );
  }

  try {
    const moderation = moderationToken ? verifyQueueModerationToken(moderationToken) : null;
    if (moderationToken && !moderation) {
      return jsonResponse({ ok: false, error: "Moderation link is invalid or expired." }, request, { status: 401, ...noStore });
    }
    const items = await listQueueSubmissions(moderation?.submissionId);
    return jsonResponse({ ok: true, items }, request, noStore);
  } catch {
    return jsonResponse(
      { ok: false, error: "Unable to load review queue." },
      request,
      { status: 500, ...noStore },
    );
  }
}
