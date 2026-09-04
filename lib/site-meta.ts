export {
  DATA_YEAR,
  CATALOG_UPDATED,
  CATALOG_DISCLAIMER,
} from "./companies";

export const SITE_NAME = "Know Your IT Hub";

export const SITE_TAGLINE = "Know your company type before you apply";

export function getSiteUrl(fallback = "http://localhost:3000") {
  return (process.env.NEXT_PUBLIC_SITE_URL || fallback).replace(/\/$/, "");
}

/** Public catalog URL — where coming-soon and browse live. */
export function getCatalogUrl() {
  const catalog = process.env.NEXT_PUBLIC_CATALOG_URL?.trim();
  if (catalog) return catalog.replace(/\/$/, "");
  return getSiteUrl();
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_SUBMIT_API_URL?.trim().replace(/\/$/, "") || "";
}

/** Absolute API host for email action links (accept-to-queue, etc.). */
export function getApiPublicUrl() {
  const configured = getApiBaseUrl();
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return getSiteUrl();
}

export function getSubmitApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/submissions` : "/api/submissions";
}

export function getCompanyAvailabilityApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/submissions/availability` : "/api/submissions/availability";
}

export function getQueueApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/submissions/queue` : "/api/submissions/queue";
}

export function getFeedbackApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/feedback` : "/api/feedback";
}

export function getContactApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/contact` : "/api/contact";
}

export function getCaptchaApiUrl() {
  const base = getApiBaseUrl();
  return base ? `${base}/api/captcha` : "/api/captcha";
}

export const DATA_ACCURACY_NOTICE = {
  title: "About this data",
  body: "We publish only verified, source-linked company profiles from public pages. Figures reflect the current catalog year and may change as companies grow, restructure, or update policies.",
  report:
    "See something wrong or outdated? Please report it through Submit request — your correction helps everyone.",
};

export const EMAIL_FOOTER = {
  disclaimer:
    "Know Your IT Hub is a community directory, not official company documentation. Profiles use public sources and may change.",
  reportLine: "Report corrections via Submit request on the site — it helps others too.",
  signOff: "— Know Your IT Hub team",
};
