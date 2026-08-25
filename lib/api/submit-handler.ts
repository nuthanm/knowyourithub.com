import { randomUUID } from "node:crypto";
import type { z, ZodType } from "zod";
import { jsonResponse } from "@/lib/api/cors";
import { buildSubscribeWelcomeEmail } from "@/lib/email-templates";
import { saveSubscriber } from "@/lib/subscribers";
import {
  buildAdminEmail,
  buildUserConfirmationEmail,
  enqueueSubmissionFromMail,
} from "@/lib/submissions";
import { isBotLikeSubmission } from "@/lib/security/anti-bot";
import { sendMail, isMailerConfigured } from "@/lib/security/mailer";
import { checkRateLimitAsync, getRequestIp } from "@/lib/security/rate-limit";
import { hasSuspiciousInput, sanitizeMultiline, sanitizeText } from "@/lib/security/sanitize";
import { verifyCaptchaToken } from "@/lib/security/math-captcha";

type SubmitOptions<T extends ZodType> = {
  request: Request;
  schema: T;
  buildAdmin: (input: z.infer<T> & { id: string }) => { subject: string; text: string; html: string };
  buildUser: (input: z.infer<T> & { id: string }) => { subject: string; text: string; html: string };
  save: (input: z.infer<T> & { id: string }) => Promise<{
    stored: boolean;
    duplicate?: boolean;
    alreadyInCatalog?: boolean;
    existingStatus?: "verified" | "awaiting_review" | "in_progress";
  }>;
  requireStorage?: boolean;
};

function sanitizeSubmissionBody<T extends Record<string, unknown>>(body: T) {
  const next = { ...body } as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (typeof value === "string") {
      next[key] = key === "message" ? sanitizeMultiline(value) : sanitizeText(value);
    }
  }
  return next as T;
}

function getUserRecipientEmail(input: Record<string, unknown>) {
  const email = input.submitterEmail ?? input.email;
  return typeof email === "string" ? email.trim() : "";
}

export async function handleFormSubmit<T extends ZodType>(options: SubmitOptions<T>) {
  const ip = getRequestIp(options.request.headers.get("x-forwarded-for"));
  const rate = await checkRateLimitAsync(ip);
  if (rate.blocked) {
    return jsonResponse(
      {
        ok: false,
        error: "Too many requests. Please try again later.",
        retryAfterSeconds: rate.retryAfterSec ?? 60,
      },
      options.request,
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await options.request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, options.request, { status: 400 });
  }

  const parsed = options.schema.safeParse(sanitizeSubmissionBody(body as Record<string, unknown>));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid form data.";
    return jsonResponse({ ok: false, error: message }, options.request, { status: 400 });
  }

  const input = parsed.data as z.infer<T> & {
    websiteField?: string;
    formStartedAt?: number;
    captchaToken?: string;
    captchaAnswer?: number;
    message?: string;
    submitterEmail?: string;
  };

  if (isBotLikeSubmission(input.websiteField, input.formStartedAt)) {
    return jsonResponse({ ok: false, error: "Unable to submit request." }, options.request, { status: 400 });
  }

  const captchaOk = verifyCaptchaToken(input.captchaToken, input.captchaAnswer);
  if (!captchaOk) {
    return jsonResponse({ ok: false, error: "CAPTCHA verification failed." }, options.request, { status: 400 });
  }

  const textFields = Object.values(input).filter((v) => typeof v === "string") as string[];
  if (textFields.some(hasSuspiciousInput)) {
    return jsonResponse({ ok: false, error: "Invalid characters in submission." }, options.request, { status: 400 });
  }

  const id = randomUUID();
  const record = { ...input, id };
  const stored = await options.save(record);

  if (options.requireStorage && !stored.stored) {
    return jsonResponse(
      { ok: false, error: "Submissions are temporarily unavailable. Please try again later." },
      options.request,
      { status: 503 },
    );
  }

  if (stored.alreadyInCatalog) {
    const error = stored.existingStatus === "verified"
      ? "This company is already verified in the catalog. Select Edit an existing company to request a change."
      : stored.existingStatus === "in_progress"
        ? "This company is already in the review queue and is currently being researched."
        : "This company is already in the review queue and is awaiting review.";
    return jsonResponse(
      { ok: false, error },
      options.request,
      { status: 409 },
    );
  }

  if (stored.duplicate) {
    return jsonResponse(
      { ok: true, id, duplicate: true, existingStatus: stored.existingStatus },
      options.request,
    );
  }

  const hasSubscriberOptIn =
    typeof (record as Record<string, unknown>).subscribeToUpdates === "boolean" &&
    Boolean((record as Record<string, unknown>).subscribeToUpdates);
  if (hasSubscriberOptIn) {
    const email = typeof input.submitterEmail === "string" ? input.submitterEmail.trim() : "";
    const name = typeof (record as Record<string, unknown>).submitterName === "string"
      ? String((record as Record<string, unknown>).submitterName).trim()
      : "";

    if (email) {
      await saveSubscriber({ id: randomUUID(), email, name: name || undefined, source: "submit_form" });
      if (isMailerConfigured()) {
        try {
          const welcome = buildSubscribeWelcomeEmail({ name: name || "there", email });
          await sendMail({ to: email, ...welcome });
        } catch {
          // Keep submission success even if welcome mail fails.
        }
      }
    }
  }

  if (isMailerConfigured()) {
    try {
      const adminTo = process.env.MAIL_TO?.trim();
      if (adminTo) {
        const adminEmail = options.buildAdmin(record);
        await sendMail({ to: adminTo, ...adminEmail });
      }
      const userEmailAddress = getUserRecipientEmail(record as Record<string, unknown>);
      if (userEmailAddress) {
        const userEmail = options.buildUser(record);
        await sendMail({ to: userEmailAddress, ...userEmail });
      }
    } catch (error) {
      console.error("Mail send failed:", error);
    }
  }

  return jsonResponse({ ok: true, id, duplicate: Boolean(stored.duplicate) }, options.request);
}

export async function handleSubmissionPost(request: Request) {
  const { submissionSchema } = await import("@/lib/validators");
  return handleFormSubmit({
    request,
    schema: submissionSchema,
    buildAdmin: buildAdminEmail,
    buildUser: buildUserConfirmationEmail,
    save: async (input) => {
      const result = await enqueueSubmissionFromMail(input);
      return {
        stored: result.stored,
        duplicate: result.duplicate,
        alreadyInCatalog: result.alreadyInCatalog,
        existingStatus: result.existingStatus,
      };
    },
    requireStorage: true,
  });
}
