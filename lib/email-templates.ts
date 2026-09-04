import { DATA_YEAR } from "./companies";
import { contactTopicLabel } from "./contact-store";
import { helpedLabel } from "./feedback-store";
import { escapeHtml } from "./security/sanitize";
import { createQueueAcceptToken, createQueueModerationToken } from "./security/queue-token";
import { EMAIL_FOOTER, getApiPublicUrl, getCatalogUrl, getSiteUrl, SITE_NAME } from "./site-meta";
import type { ContactInput, FeedbackInput, SubmissionInput } from "./validators";

function emailShell(title: string, bodyHtml: string) {
  const site = escapeHtml(getSiteUrl());
  const brand = escapeHtml(SITE_NAME);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#111827">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #dbe5f3;border-radius:14px;overflow:hidden;background:#ffffff">
            <tr>
              <td style="padding:18px 22px;background:linear-gradient(120deg, rgba(10,102,194,0.12) 0%, rgba(10,102,194,0.04) 100%);border-bottom:1px solid #dbe5f3">
                <div style="font-size:20px;font-weight:700;letter-spacing:0.1px;color:#0f172a">${brand}</div>
                <div style="font-size:12px;color:#475569;margin-top:4px">Verified catalog · ${DATA_YEAR}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 22px 8px">
                <h2 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#111827">${escapeHtml(title)}</h2>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px 24px">
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 14px" />
                <p style="font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(EMAIL_FOOTER.disclaimer)}</p>
                <p style="font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(EMAIL_FOOTER.reportLine)}</p>
                <p style="font-size:12px;margin:0 0 10px">
                  <a href="${site}/submit" style="color:#0a66c2;text-decoration:none">Submit a correction</a>
                  ·
                  <a href="${site}/contact" style="color:#0a66c2;text-decoration:none">Contact</a>
                  ·
                  <a href="${site}/feedback" style="color:#0a66c2;text-decoration:none">Share feedback</a>
                </p>
                <p style="font-size:11px;color:#94a3b8;margin:0">Source domain: ${site.replace("http://", "").replace("https://", "")}</p>
                <p style="font-size:12px;color:#64748b;margin:10px 0 0">${escapeHtml(EMAIL_FOOTER.signOff)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function textFooter() {
  return [
    "",
    EMAIL_FOOTER.disclaimer,
    EMAIL_FOOTER.reportLine,
    `${getSiteUrl()}/submit`,
    "",
    EMAIL_FOOTER.signOff,
  ].join("\n");
}

function buildAddToQueueUrl(input: SubmissionInput & { id: string }) {
  const token = createQueueAcceptToken({
    id: input.id,
    companyName: input.companyName,
    companySlug: input.companySlug,
    website: input.website || undefined,
    requestType: input.requestType,
    message: input.message,
    submitterName: input.submitterName,
    submitterEmail: input.submitterEmail,
  });
  return `${getApiPublicUrl()}/api/submissions/queue/accept?token=${encodeURIComponent(token)}`;
}

function queueStageLabel(stage: "awaiting_review" | "in_progress" | "verified") {
  if (stage === "awaiting_review") return "Awaiting review";
  if (stage === "in_progress") return "In progress";
  return "Verified";
}

function queueStageMessage(stage: "awaiting_review" | "in_progress" | "verified") {
  if (stage === "awaiting_review") {
    return "A new company request entered the review queue and is awaiting verification.";
  }
  if (stage === "in_progress") {
    return "A queued company is now in progress while maintainers validate official sources.";
  }
  return "A company request completed review and is now verified in the catalog.";
}

function queueStageCta(stage: "awaiting_review" | "in_progress" | "verified") {
  if (stage === "awaiting_review") {
    return {
      heading: "Request accepted into queue",
      detail:
        "We have accepted this request and placed it in the verification queue. Next, maintainers will validate official sources.",
      cta: "Track in review queue",
    };
  }
  if (stage === "in_progress") {
    return {
      heading: "Verification is in progress",
      detail:
        "Maintainers are currently checking official website/careers/locations references before publishing final details.",
      cta: "See current queue status",
    };
  }
  return {
    heading: "Company is now verified",
    detail:
      "Review completed. The company profile now appears as verified in the catalog with source-linked details.",
    cta: "Open verified profile",
  };
}

export function buildAdminEmail(input: SubmissionInput & { id: string }) {
  const site = getSiteUrl();
  const catalog = getCatalogUrl();
  const addToQueueUrl = buildAddToQueueUrl(input);
  const moderationToken = createQueueModerationToken(input.id);
  const moderationUrl = `${catalog}/coming-soon/?moderate=${encodeURIComponent(moderationToken)}`;
  const subject = `[${SITE_NAME}] ${input.requestType === "add" ? "Add" : "Edit"} request: ${input.companyName}`;
  const lines = [
    `New ${input.requestType} request for the ${DATA_YEAR} catalog.`,
    "",
    `Request ID: ${input.id}`,
    `Type: ${input.requestType}`,
    `Company: ${input.companyName}`,
    input.companySlug ? `Existing slug: ${input.companySlug}` : "",
    input.website ? `Website: ${input.website}` : "",
    `From: ${input.submitterName} <${input.submitterEmail}>`,
    input.subscribeToUpdates ? "Also opted in to catalog update notifications." : "",
    "",
    "Message:",
    input.message,
    "",
    `Add to review queue: ${addToQueueUrl}`,
    `Open moderation console: ${moderationUrl}`,
    `Review queue: ${catalog}/coming-soon/`,
    `Submit form: ${site}/submit`,
    textFooter(),
  ].filter(Boolean);

  const html = emailShell(
    `New company ${input.requestType} request`,
    `
      <p>A visitor submitted a correction for the <strong>${DATA_YEAR}</strong> catalog. Verify on the <strong>official company website</strong> before publishing.</p>
      <p><strong>ID:</strong> ${escapeHtml(input.id)}</p>
      <p><strong>Company:</strong> ${escapeHtml(input.companyName)}</p>
      ${input.companySlug ? `<p><strong>Slug:</strong> ${escapeHtml(input.companySlug)}</p>` : ""}
      ${input.website ? `<p><strong>Website:</strong> ${escapeHtml(input.website)}</p>` : ""}
      <p><strong>Submitter:</strong> ${escapeHtml(input.submitterName)} (${escapeHtml(input.submitterEmail)})</p>
      ${input.subscribeToUpdates ? "<p><strong>Update alerts:</strong> Yes — add to subscriber list after review.</p>" : ""}
      <pre style="white-space:pre-wrap;font-family:inherit;background:#f7f5f0;padding:12px;border-radius:8px">${escapeHtml(input.message)}</pre>
      <p style="margin:20px 0 8px">
        <a href="${escapeHtml(addToQueueUrl)}" style="display:inline-block;background:#0a66c2;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
          Add ${escapeHtml(input.companyName)} to review queue
        </a>
      </p>
      <p style="margin:0 0 10px">
        <a href="${escapeHtml(moderationUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">
          Open moderation console (no login)
        </a>
      </p>
      <p style="font-size:12px;color:#737373;margin:0">
        Opens the review queue and lists this company as pending.
        <a href="${escapeHtml(catalog)}/coming-soon/" style="color:#0a66c2">View queue</a>
      </p>
    `,
  );

  return { subject, text: lines.join("\n"), html };
}

export function buildUserConfirmationEmail(input: SubmissionInput & { id: string }) {
  const site = getSiteUrl();
  const subject = `We received your ${SITE_NAME} request (${DATA_YEAR} catalog)`;
  const updateLine = input.subscribeToUpdates
    ? "You opted in to email alerts. We will notify you when this request moves through review and when new companies are verified."
    : "";
  const text = [
    `Hi ${input.submitterName},`,
    "",
    `Thank you for helping keep ${SITE_NAME} accurate.`,
    "",
    `We received your request to ${input.requestType === "add" ? "add" : "update"} ${input.companyName}.`,
    `Reference: ${input.id}`,
    "",
    "Our team manually checks every field against official pages before a profile gets the Verified stamp.",
    input.requestType === "add"
      ? `Track progress on the review queue: ${getSiteUrl()}/coming-soon`
      : "",
    updateLine,
    textFooter(),
  ].filter(Boolean).join("\n");

  const html = emailShell(
    "Request received — thank you",
    `
      <p>Hi ${escapeHtml(input.submitterName)},</p>
      <p>Thank you for helping keep <strong>${escapeHtml(SITE_NAME)}</strong> accurate for everyone.</p>
      <p>We received your request to <strong>${input.requestType === "add" ? "add" : "update"} ${escapeHtml(input.companyName)}</strong> on the ${DATA_YEAR} catalog.</p>
      <p>Reference: <code>${escapeHtml(input.id)}</code></p>
      <p>We manually validate content on official company pages before awarding the <strong>Verified</strong> stamp.</p>
      ${input.requestType === "add" ? `<p>Track progress on the <a href="${site}/coming-soon" style="color:#0a66c2">review queue</a> while we research your request.</p>` : ""}
      ${input.subscribeToUpdates ? "<p>You opted in to catalog update emails — we will notify you when new verified companies are published.</p>" : ""}
    `,
  );

  return { subject, text, html };
}

export function getQueueStageNotificationTarget(
  stage: "awaiting_review" | "in_progress" | "verified",
  submitterEmail?: string,
) {
  if (stage === "in_progress") {
    const email = submitterEmail?.trim();
    return email ? { mode: "submitter" as const, recipients: [email] } : { mode: "none" as const, recipients: [] };
  }

  if (stage === "verified") {
    return { mode: "allSubscribers" as const, recipients: [] };
  }

  return { mode: "none" as const, recipients: [] };
}

export function buildSubmissionRejectedEmail(input: { companyName: string; submitterName: string }) {
  const subject = `Update on your ${SITE_NAME} request for ${input.companyName}`;
  const text = [
    `Hi ${input.submitterName},`,
    "",
    `We completed our review of your request for ${input.companyName}.`,
    "",
    "We are unable to add this request to the catalog at this time. This can happen when we cannot verify the company details from official sources or when the request does not fit the catalog scope.",
    "",
    `You can submit additional official-source details or a correction here: ${getSiteUrl()}/submit`,
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "Update on your request",
    `
      <p>Hi ${escapeHtml(input.submitterName)},</p>
      <p>We completed our review of your request for <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>We are unable to add this request to the catalog at this time. This can happen when we cannot verify the company details from official sources or when the request does not fit the catalog scope.</p>
      <p>You can submit additional official-source details or a correction through <a href="${getSiteUrl()}/submit" style="color:#0a66c2">Submit request</a>.</p>
    `,
  );

  return { subject, text, html };
}

export function buildSubscribeWelcomeEmail(input: { name: string; email: string }) {
  const subject = `${SITE_NAME} update alerts — you're on the list`;
  const text = [
    `Hi ${input.name},`,
    "",
    `Thanks for subscribing to ${SITE_NAME} catalog updates for ${DATA_YEAR}.`,
    "We will email you when we add or verify new companies — with details of what changed.",
    "",
    "Every listed company is manually checked on official pages before it receives our Verified stamp.",
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "You're subscribed to catalog updates",
    `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Thanks for subscribing to <strong>${escapeHtml(SITE_NAME)}</strong> update alerts.</p>
      <p>We will email you when we add or verify companies on the ${DATA_YEAR} catalog — including what was added or updated.</p>
      <p>Only profiles that pass manual review on official sources receive our <strong>Verified</strong> stamp.</p>
    `,
  );

  return { subject, text, html };
}

export function buildQueueStageBroadcastEmail(input: {
  companyName: string;
  companySlug?: string;
  stage: "awaiting_review" | "in_progress" | "verified";
}) {
  const site = getSiteUrl();
  const stage = queueStageLabel(input.stage);
  const message = queueStageMessage(input.stage);
  const info = queueStageCta(input.stage);
  const profilePath = input.companySlug ? `/companies/${input.companySlug}` : "/coming-soon";
  const profileUrl = `${site}${profilePath}`;

  const subject = `[${SITE_NAME}] ${input.companyName} status update: ${stage}`;
  const text = [
    `${input.companyName} moved to: ${stage}`,
    "",
    info.heading,
    info.detail,
    "",
    message,
    "",
    input.stage === "verified"
      ? `${info.cta}: ${profileUrl}`
      : `${info.cta}: ${site}/coming-soon`,
    textFooter(),
  ].filter(Boolean).join("\n");

  const html = emailShell(
    `${escapeHtml(input.companyName)} status update`,
    `
      <p><strong>${escapeHtml(input.companyName)}</strong> moved to <strong>${escapeHtml(stage)}</strong>.</p>
      <p><strong>${escapeHtml(info.heading)}</strong></p>
      <p>${escapeHtml(info.detail)}</p>
      <p>${escapeHtml(message)}</p>
      ${input.stage === "verified"
        ? `<p><a href="${escapeHtml(profileUrl)}" style="color:#0a66c2">${escapeHtml(info.cta)}</a></p>`
        : `<p><a href="${site}/coming-soon" style="color:#0a66c2">${escapeHtml(info.cta)}</a></p>`}
    `,
  );

  return { subject, text, html };
}

export function buildFeedbackAdminEmail(input: FeedbackInput & { id: string }) {
  const subject = `[${SITE_NAME}] Site feedback — ${helpedLabel(input.helped)}`;
  const text = [
    `Feedback ID: ${input.id}`,
    `From: ${input.name} <${input.email}>`,
    `Helped career decision: ${helpedLabel(input.helped)}`,
    input.message ? `Message: ${input.message}` : "",
    textFooter(),
  ].filter(Boolean).join("\n");

  const html = emailShell(
    "New site feedback",
    `
      <p><strong>ID:</strong> ${escapeHtml(input.id)}</p>
      <p><strong>From:</strong> ${escapeHtml(input.name)} (${escapeHtml(input.email)})</p>
      <p><strong>Helped pick the right company:</strong> ${escapeHtml(helpedLabel(input.helped))}</p>
      ${input.message ? `<pre style="white-space:pre-wrap;font-family:inherit;background:#f7f5f0;padding:12px;border-radius:8px">${escapeHtml(input.message)}</pre>` : ""}
    `,
  );

  return { subject, text, html };
}

export function buildFeedbackUserEmail(input: FeedbackInput & { id: string }) {
  const subject = `Thanks for your ${SITE_NAME} feedback`;
  const text = [
    `Hi ${input.name},`,
    "",
    `Thank you for sharing whether ${SITE_NAME} helped your career research.`,
    "Your opinion helps us improve the catalog for other job seekers.",
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "Thank you for your feedback",
    `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Thank you for telling us whether <strong>${escapeHtml(SITE_NAME)}</strong> helped you pick the right company.</p>
      <p>We read every response. Report data issues anytime via Submit request.</p>
    `,
  );

  return { subject, text, html };
}

export function buildContactAdminEmail(input: ContactInput & { id: string }) {
  const subject = `[${SITE_NAME}] Contact — ${contactTopicLabel(input.topic)}`;
  const text = [
    `Contact ID: ${input.id}`,
    `From: ${input.name} <${input.email}>`,
    `Topic: ${contactTopicLabel(input.topic)}`,
    "",
    "Message:",
    input.message,
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "New contact message",
    `
      <p><strong>ID:</strong> ${escapeHtml(input.id)}</p>
      <p><strong>From:</strong> ${escapeHtml(input.name)} (${escapeHtml(input.email)})</p>
      <p><strong>Topic:</strong> ${escapeHtml(contactTopicLabel(input.topic))}</p>
      <pre style="white-space:pre-wrap;font-family:inherit;background:#f7f5f0;padding:12px;border-radius:8px">${escapeHtml(input.message)}</pre>
    `,
  );

  return { subject, text, html };
}

export function buildContactUserEmail(input: ContactInput & { id: string }) {
  const subject = `We received your ${SITE_NAME} message`;
  const text = [
    `Hi ${input.name},`,
    "",
    `Thank you for contacting ${SITE_NAME}.`,
    `Topic: ${contactTopicLabel(input.topic)}`,
    `Reference: ${input.id}`,
    "",
    "We read every message and will reply when a response is needed.",
    "For company corrections, use Submit request on the site.",
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "We received your message",
    `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Thank you for contacting <strong>${escapeHtml(SITE_NAME)}</strong>.</p>
      <p><strong>Topic:</strong> ${escapeHtml(contactTopicLabel(input.topic))}</p>
      <p><strong>Reference:</strong> ${escapeHtml(input.id)}</p>
      <p>We read every message and will reply when a response is needed. For company corrections, use Submit request.</p>
    `,
  );

  return { subject, text, html };
}
