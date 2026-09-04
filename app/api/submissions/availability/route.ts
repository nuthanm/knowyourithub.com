import { corsPreflightResponse, jsonResponse } from "@/lib/api/cors";
import { getCompanyAvailability } from "@/lib/submissions";

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const companyName = new URL(request.url).searchParams.get("companyName")?.trim() ?? "";
  if (companyName.length < 2 || companyName.length > 120) {
    return jsonResponse({ ok: false, error: "Enter a company name between 2 and 120 characters." }, request, { status: 400 });
  }

  const availability = await getCompanyAvailability(companyName);
  if (availability.reason === "unavailable") {
    return jsonResponse({ ok: false, error: "Company availability is temporarily unavailable." }, request, { status: 503 });
  }
  return jsonResponse({ ok: true, ...availability }, request, { headers: { "Cache-Control": "no-store" } });
}