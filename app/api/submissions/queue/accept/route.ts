import { corsPreflightResponse } from "@/lib/api/cors";
import {
  createMailBannerToken,
  verifyQueueAcceptToken,
} from "@/lib/security/queue-token";
import { getCatalogUrl } from "@/lib/site-meta";
import { enqueueSubmissionFromMail, resolveSubmissionSlug } from "@/lib/submissions";

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const payload = verifyQueueAcceptToken(token);

  if (!payload) {
    return new Response("This queue link is invalid or has expired.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const slug = payload.companySlug?.trim() || resolveSubmissionSlug({
    companyName: payload.companyName,
    companySlug: payload.companySlug,
  });

  const result = await enqueueSubmissionFromMail({
    id: payload.id,
    requestType: payload.requestType,
    companyName: payload.companyName,
    companySlug: slug,
    website: payload.website || "",
    submitterName: payload.submitterName,
    submitterEmail: payload.submitterEmail,
    message: payload.message,
    acceptPolicy: true,
  });

  if (!result.stored) {
    return new Response("The review queue is temporarily unavailable. Please try again later.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (result.alreadyInCatalog) {
    return new Response("This company is already listed in the catalog. Submit an edit request to suggest a change.", {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const bannerToken = createMailBannerToken(
    result.item.name,
    result.item.id,
    result.duplicate ? "already_queued" : "added",
  );
  const catalog = getCatalogUrl();
  const redirectTo = new URL(`${catalog}/coming-soon/`);
  redirectTo.searchParams.set("from", "mail");
  redirectTo.searchParams.set("banner", bannerToken);

  return Response.redirect(redirectTo.toString(), 302);
}
