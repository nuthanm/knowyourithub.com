import { DATA_YEAR } from "./companies";
import { contactTopicLabel } from "./contact-store";
import { helpedLabel } from "./feedback-store";
import { escapeHtml } from "./security/sanitize";
import { createQueueAcceptToken, createQueueModerationToken } from "./security/queue-token";
import { EMAIL_FOOTER, getApiPublicUrl, getCatalogUrl, getSiteUrl, SITE_NAME } from "./site-meta";
import type { ContactInput, FeedbackInput, SubmissionInput } from "./validators";

type EmailStep = "received" | "review" | "verified";

type EmailShellOptions = {
  kicker?: string;
  preheader?: string;
  showOptOut?: boolean;
};

function emailButton(href: string, label: string) {
  return `
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#0a66c2;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;font-size:13px;line-height:1.2">
      ${escapeHtml(label)}
    </a>
  `;
}

function emailSteps(current: EmailStep) {
  const steps: Array<{ id: EmailStep; label: string }> = [
    { id: "received", label: "Received" },
    { id: "review", label: "In review" },
    { id: "verified", label: "Verified" },
  ];

  return `
    <p style="margin:16px 0 18px">
      ${steps
        .map((step) => {
          const active = step.id === current;
          const style = active
            ? "display:inline-block;padding:5px 11px;border-radius:999px;background:#0a66c2;color:#ffffff;font-size:12px;font-weight:700;margin:0 6px 6px 0;border:1px solid #0a66c2"
            : "display:inline-block;padding:5px 11px;border-radius:999px;background:#ffffff;color:#64748b;font-size:12px;font-weight:700;margin:0 6px 6px 0;border:1px solid #dbe5f3";
          return `<span style="${style}">${escapeHtml(step.label)}</span>`;
        })
        .join("")}
    </p>
  `;
}

function emailKv(rows: Array<[string, string]>) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 14px">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding:7px 12px 7px 0;width:30%;color:#64748b;font-size:12px;font-weight:700;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:7px 0;font-size:14px;color:#141414;vertical-align:top">${escapeHtml(value)}</td>
        </tr>
      `,
        )
        .join("")}
    </table>
  `;
}

function emailQuote(text: string) {
  return `<p style="margin:0 0 16px;background:#f7f5f0;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.5;color:#4a4a4a;white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</p>`;
}

function emailProfileCard(name: string, detail: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e8e4dc;border-radius:12px;background:#ffffff;margin:0 0 16px">
      <tr>
        <td style="padding:14px 16px">
          <div style="font-size:16px;font-weight:700;color:#0c1929">${escapeHtml(name)}</div>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.45;color:#4a4a4a">${escapeHtml(detail)}</p>
        </td>
      </tr>
    </table>
  `;
}

function emailShell(title: string, bodyHtml: string, options: EmailShellOptions = {}) {
  const site = escapeHtml(getSiteUrl());
  const brand = escapeHtml(SITE_NAME);
  const kicker = escapeHtml(options.kicker ?? `Verified catalog · ${DATA_YEAR}`);
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(options.preheader)}</div>`
    : "";
  const optOut = options.showOptOut
    ? `<p style="font-size:12px;color:#64748b;margin:0 0 8px">You received this because you opted in to catalog update emails. Use <a href="${site}/contact" style="color:#0a66c2;text-decoration:none">Contact</a> to stop these emails.</p>`
    : "";

  return `
    ${preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#141414">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #dbe5f3;border-radius:14px;overflow:hidden;background:#ffffff">
            <tr>
              <td style="padding:16px 20px;background:#0c1929">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;background:#ffffff;border-radius:6px;font-family:Georgia,Times New Roman,serif;font-size:14px;font-weight:700;color:#0c1929">K</td>
                    <td width="12"></td>
                    <td>
                      <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:Georgia,Times New Roman,serif">${brand}</div>
                      <div style="font-size:12px;color:#b7c3d1;margin-top:2px">${kicker}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 22px 8px">
                <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#0c1929;font-family:Georgia,Times New Roman,serif;font-weight:700">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 22px 24px">
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 14px" />
                <p style="font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(EMAIL_FOOTER.disclaimer)}</p>
                <p style="font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(EMAIL_FOOTER.reportLine)}</p>
                ${optOut}
                <p style="font-size:12px;margin:0 0 10px">
                  <a href="${site}/submit" style="color:#0a66c2;text-decoration:none">Submit a correction</a>
                  ·
                  <a href="${site}/contact" style="color:#0a66c2;text-decoration:none">Contact</a>
                  ·
                  <a href="${site}/feedback" style="color:#0a66c2;text-decoration:none">Feedback</a>
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

function textFooter(showOptOut = false) {
  return [
    "",
    EMAIL_FOOTER.disclaimer,
    EMAIL_FOOTER.reportLine,
    ...(showOptOut
      ? [
          "You received this because you opted in to catalog update emails. Use Contact on the site to stop these emails.",
        ]
      : []),
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

function queueStep(stage: "awaiting_review" | "in_progress" | "verified"): EmailStep {
  if (stage === "verified") return "verified";
  if (stage === "in_progress") return "review";
  return "review";
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
    `New ${input.requestType} request`,
    `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#4a4a4a">A visitor submitted a request for the ${DATA_YEAR} catalog. Verify on the official company website before publishing.</p>
      ${emailKv(
        [
          ["Company", input.companyName],
          ["Type", input.requestType === "add" ? "Add" : "Edit"],
          input.website ? ["Website", input.website] : null,
          ["From", `${input.submitterName} (${input.submitterEmail})`],
          ["Reference", input.id],
        ].filter(Boolean) as Array<[string, string]>,
      )}
      ${emailQuote(input.message)}
      <p style="margin:0 0 10px">${emailButton(addToQueueUrl, `Add ${input.companyName} to review queue`)}</p>
      <p style="font-size:12px;color:#737373;margin:0">
        Opens the review queue and lists this company as pending.
        <a href="${escapeHtml(moderationUrl)}" style="color:#0a66c2">Open moderation console</a>
      </p>
    `,
    {
      kicker: "Maintainer action needed",
      preheader: `${input.requestType === "add" ? "Add" : "Edit"} request for ${input.companyName}`,
    },
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
    "Status: Received → In review → Verified",
    "A person will check official pages before this company can receive the Verified stamp.",
    input.requestType === "add" ? `Track progress on the review queue: ${site}/coming-soon` : "",
    updateLine,
    textFooter(),
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailShell(
    "Request received",
    `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Hi ${escapeHtml(input.submitterName)},</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">We received your request to <strong>${input.requestType === "add" ? "add" : "update"} ${escapeHtml(input.companyName)}</strong>.</p>
      <p style="margin:0 0 4px;font-size:14px;color:#4a4a4a">Reference <code style="font-family:inherit">${escapeHtml(input.id)}</code></p>
      ${emailSteps("received")}
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4a4a4a">A person will check official pages before this company can receive the Verified stamp.</p>
      ${input.requestType === "add" ? `<p style="margin:0 0 10px">${emailButton(`${site}/coming-soon`, "Track in review queue")}</p>` : ""}
      ${input.subscribeToUpdates ? "<p style=\"margin:12px 0 0;font-size:13px;color:#64748b\">You opted in to catalog update emails — we will notify you when this request is verified.</p>" : ""}
    `,
    {
      preheader: `We received your request for ${input.companyName}. Reference ${input.id}.`,
    },
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
    `We completed our review of ${input.companyName}.`,
    "",
    "We could not add this company yet. This can happen when we cannot verify the details from official sources, or the request is outside catalog scope.",
    "",
    `If you have an official About or careers URL, submit those details and we will review again: ${getSiteUrl()}/submit`,
    textFooter(),
  ].join("\n");

  const html = emailShell(
    "We could not add this company yet",
    `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Hi ${escapeHtml(input.submitterName)},</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">We completed our review of <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4a4a4a">We could not verify the details from official sources, or the request is outside catalog scope.</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">If you have an official About or careers URL, submit those details and we will review again.</p>
      <p style="margin:0">${emailButton(`${getSiteUrl()}/submit`, "Submit more sources")}</p>
    `,
    {
      kicker: "Update on your request",
      preheader: `We could not add ${input.companyName} yet. You can submit official sources to review again.`,
    },
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
    textFooter(true),
  ].join("\n");

  const html = emailShell(
    "You're subscribed to catalog updates",
    `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Hi ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Thanks for subscribing to <strong>${escapeHtml(SITE_NAME)}</strong> update alerts.</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">We will email you when we add or verify companies on the ${DATA_YEAR} catalog — including what was added or updated.</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#4a4a4a">Only profiles that pass manual review on official sources receive our <strong>Verified</strong> stamp.</p>
    `,
    {
      preheader: `You're on the ${SITE_NAME} catalog update list for ${DATA_YEAR}.`,
      showOptOut: true,
    },
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
  const ctaHref = input.stage === "verified" ? profileUrl : `${site}/coming-soon`;
  const isBroadcast = input.stage === "verified";

  const subject = `[${SITE_NAME}] ${input.companyName} status update: ${stage}`;
  const text = [
    `${input.companyName} moved to: ${stage}`,
    "",
    info.heading,
    info.detail,
    "",
    message,
    "",
    `${info.cta}: ${ctaHref}`,
    textFooter(isBroadcast),
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailShell(
    input.stage === "verified" ? `${input.companyName} is now verified` : `${input.companyName} status update`,
    `
      ${emailSteps(queueStep(input.stage))}
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a"><strong>${escapeHtml(info.heading)}</strong></p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#4a4a4a">${escapeHtml(info.detail)}</p>
      ${
        input.stage === "verified"
          ? emailProfileCard(input.companyName, "Now live in the catalog with source-linked details.")
          : `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4a4a4a">${escapeHtml(message)}</p>`
      }
      <p style="margin:0">${emailButton(ctaHref, info.cta)}</p>
    `,
    {
      kicker: input.stage === "verified" ? "Catalog update" : `Verified catalog · ${DATA_YEAR}`,
      preheader: `${input.companyName} moved to ${stage}.`,
      showOptOut: isBroadcast,
    },
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
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailShell(
    "New site feedback",
    `
      ${emailKv([
        ["From", `${input.name} (${input.email})`],
        ["Helped", helpedLabel(input.helped)],
        ["Reference", input.id],
      ])}
      ${input.message ? emailQuote(input.message) : ""}
    `,
    {
      kicker: "Maintainer action needed",
      preheader: `Feedback from ${input.name}: ${helpedLabel(input.helped)}`,
    },
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
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Hi ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Thank you for telling us whether <strong>${escapeHtml(SITE_NAME)}</strong> helped you pick the right company.</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#4a4a4a">We read every response. Report data issues anytime via Submit request.</p>
    `,
    {
      preheader: "We received your feedback and read every response.",
    },
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
      ${emailKv([
        ["From", `${input.name} (${input.email})`],
        ["Topic", contactTopicLabel(input.topic)],
        ["Reference", input.id],
      ])}
      ${emailQuote(input.message)}
    `,
    {
      kicker: "Maintainer action needed",
      preheader: `Contact from ${input.name}: ${contactTopicLabel(input.topic)}`,
    },
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
      <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#4a4a4a">Hi ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#4a4a4a">Thank you for contacting <strong>${escapeHtml(SITE_NAME)}</strong>.</p>
      ${emailKv([
        ["Topic", contactTopicLabel(input.topic)],
        ["Reference", input.id],
      ])}
      <p style="margin:0;font-size:14px;line-height:1.55;color:#4a4a4a">We read every message and will reply when a response is needed. For company corrections, use Submit request.</p>
    `,
    {
      preheader: `We received your message. Reference ${input.id}.`,
    },
  );

  return { subject, text, html };
}
