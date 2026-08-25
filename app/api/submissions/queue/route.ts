import { jsonResponse, corsPreflightResponse } from "@/lib/api/cors";
import { verifyMailBannerToken } from "@/lib/security/queue-token";
import { listQueueSubmissions } from "@/lib/submissions";

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bannerToken = url.searchParams.get("banner");
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
    const items = await listQueueSubmissions();
    return jsonResponse({ ok: true, items }, request, noStore);
  } catch {
    return jsonResponse(
      { ok: false, error: "Unable to load review queue." },
      request,
      { status: 500, ...noStore },
    );
  }
}
