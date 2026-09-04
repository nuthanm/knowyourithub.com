"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FormActions } from "@/components/FormLayout";
import { COMPANIES } from "@/lib/companies";
import { getCompanyAvailabilityApiUrl, getSubmitApiUrl } from "@/lib/site-meta";
import { submissionSchema, type SubmissionInput } from "@/lib/validators";
import { MathCaptchaField } from "./MathCaptchaField";
import { AppSelect } from "./AppSelect";
import { IconInfo } from "./PortalIcons";

type FormValues = z.input<typeof submissionSchema>;

function formatRetryAfter(retryAfterSeconds: number) {
  const minutes = Math.floor(retryAfterSeconds / 60);
  const seconds = retryAfterSeconds % 60;
  if (minutes === 0) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} and ${seconds} seconds`;
}

export function CompanySubmissionForm({
  initialSlug,
  initialCompanyName,
}: {
  initialSlug?: string;
  initialCompanyName?: string;
}) {
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [duplicateStatus, setDuplicateStatus] = useState<"awaiting_review" | "in_progress" | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "exists" | "error">("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues, unknown, SubmissionInput>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      requestType: initialSlug ? "edit" : "add",
      companySlug: initialSlug ?? "",
      companyName: initialCompanyName ?? "",
      isPortalRequest: true,
      acceptPolicy: undefined,
    },
  });

  const requestType = useWatch({ control, name: "requestType" });
  const companyName = useWatch({ control, name: "companyName" });
  const companySlug = useWatch({ control, name: "companySlug" });
  const acceptPolicy = useWatch({ control, name: "acceptPolicy" });
  const isNewCompanyBlocked = requestType === "add" && availability === "exists";

  useEffect(() => {
    setValue("formStartedAt", Date.now());
  }, [setValue]);

  useEffect(() => {
    setAvailability("idle");
    setAvailabilityMessage("");
  }, [companyName, requestType]);

  function clearDisplayedErrors() {
    setStatus("idle");
    setErrorMessage("");
    setCaptchaError("");
    clearErrors();
  }

  async function checkAvailability() {
    const name = companyName.trim();
    if (name.length < 2 || availability === "checking") return;
    setAvailability("checking");
    setAvailabilityMessage("");

    try {
      const response = await fetch(
        `${getCompanyAvailabilityApiUrl()}?companyName=${encodeURIComponent(name)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as { ok?: boolean; available?: boolean; name?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to check company availability.");
      if (data.available) {
        setAvailability("available");
        setAvailabilityMessage(`${name} is not in the catalog or review queue. You can submit it.`);
      } else {
        setAvailability("exists");
        setAvailabilityMessage(`${data.name || name} already exists in the catalog or review queue.`);
      }
    } catch (error) {
      setAvailability("error");
      setAvailabilityMessage(error instanceof Error ? error.message : "Unable to check company availability.");
    }
  }

  function getFriendlyErrorMessage(message: string) {
    if (message.includes("did not match the expected pattern") || message.includes("valid website")) {
      return "Please check the website URL and try again.";
    }
    if (message.includes("CAPTCHA")) {
      return "Please complete the quick check correctly before submitting.";
    }
    if (message.includes("Privacy Policy and Terms")) {
      return "You must accept the Privacy Policy and Terms before submitting.";
    }
    if (message.includes("at least 20 characters")) {
      return "Please add a bit more detail so we can verify the request.";
    }
    if (message.includes("valid email")) {
      return "Please enter a valid email address.";
    }
    return "Please review the highlighted fields and try again.";
  }

  async function onSubmit(values: FormValues) {
    if (requestType === "add" && availability !== "available") return;
    if (requestType === "edit" && !companySlug) return;
    setStatus("loading");
    setErrorMessage("");
    setDuplicateStatus(undefined);
    setCaptchaError("");

    const isValid = await trigger();
    if (!isValid) {
      setStatus("error");
      setErrorMessage("Please review the highlighted fields and correct the errors before submitting.");
      return;
    }

    if (!captchaToken) {
      setStatus("error");
      setCaptchaError("CAPTCHA token is missing. Please refresh.");
      return;
    }
    if (!captchaAnswer.trim()) {
      setStatus("error");
      setCaptchaError("Please answer the CAPTCHA question.");
      return;
    }
    const answer = Number(captchaAnswer);
    if (!Number.isFinite(answer)) {
      setStatus("error");
      setCaptchaError("CAPTCHA answer must be a number.");
      return;
    }

    try {
      const res = await fetch(getSubmitApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          captchaToken,
          captchaAnswer: answer,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        duplicate?: boolean;
        existingStatus?: "verified" | "awaiting_review" | "in_progress";
        error?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok || !json.ok) {
        if (res.status === 429) {
          const retryAfterSeconds = Number.isFinite(json.retryAfterSeconds)
            ? Math.max(1, Math.ceil(json.retryAfterSeconds as number))
            : 10 * 60;
          throw new Error(
            `This network has reached the submission limit. Please wait ${formatRetryAfter(retryAfterSeconds)} before trying again. Alternatively, email your request to inbox.nuthan@gmail.com and we will add it to the review queue.`,
          );
        }
        throw new Error(json.error || "Unable to submit request.");
      }
      setDuplicateStatus(json.existingStatus === "in_progress" || json.existingStatus === "awaiting_review"
        ? json.existingStatus
        : undefined);
      setStatus(json.duplicate ? "duplicate" : "success");
    } catch (err) {
      const serverMessage = err instanceof Error ? err.message : "Unable to submit request.";
      setStatus("error");
      setErrorMessage(getFriendlyErrorMessage(serverMessage));
      setCaptchaAnswer("");
      setCaptchaToken("");
      setCaptchaResetKey((k) => k + 1);
    }
  }

  if (status === "success") {
    return (
      <div className="form-success">
        <h2>Request received</h2>
        <p>
          Thanks — we received your {requestType === "add" ? "add" : "edit"} request. No sign-in is
          required. We will email you if we need more details.
        </p>
        {requestType === "add" && (
          <p>
            Your company will appear on the{" "}
            <Link href="/coming-soon">review queue</Link> while we verify official sources.
          </p>
        )}
        <Link href="/" className="app-btn primary">
          Back to browse
        </Link>
      </div>
    );
  }

  if (status === "duplicate") {
    const isInProgress = duplicateStatus === "in_progress";
    return (
      <div className="form-success">
        <h2>Company already in review</h2>
        <p>
          {companyName || "This company"} is already in the review queue and is {isInProgress
            ? "currently being researched"
            : "awaiting review"}. We keep one active request per company so the team can review it
          without duplicates.
        </p>
        <Link href="/coming-soon" className="app-btn primary">
          View review queue
        </Link>
      </div>
    );
  }

  return (
    <form className="app-form" onSubmit={handleSubmit(onSubmit)} onChange={clearDisplayedErrors} noValidate>
      <input type="hidden" {...register("formStartedAt")} />
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="websiteField">Website</label>
        <input id="websiteField" tabIndex={-1} autoComplete="off" {...register("websiteField")} />
      </div>

      <fieldset className="form-field">
        <legend>Request type</legend>
        <div className="radio-group">
          <label className="radio-pill">
            <input type="radio" value="add" {...register("requestType")} />
            Add a new company
          </label>
          <label className="radio-pill">
            <input type="radio" value="edit" {...register("requestType")} />
            Edit an existing company
          </label>
        </div>
      </fieldset>

      {requestType === "add" && (
        <div className="form-field">
          <label htmlFor="companyName">Company name *</label>
          <div className="form-field-action">
            <input
              id="companyName"
              type="text"
              {...register("companyName")}
              placeholder="e.g. Razorpay"
              autoComplete="organization"
            />
            <button
              type="button"
              className="availability-check-btn"
              disabled={companyName.trim().length < 2 || availability === "checking"}
              onClick={() => void checkAvailability()}
            >
              {availability === "checking" ? "Checking…" : "Check availability"}
            </button>
          </div>
          {availabilityMessage && (
            <p className={availability === "available" ? "form-availability-success" : "form-error"}>
              {availabilityMessage}
            </p>
          )}
          {errors.companyName && <p className="form-error">{errors.companyName.message}</p>}
        </div>
      )}

      {requestType === "edit" && (
        <div className="form-field">
          <label htmlFor="companySlug">Existing company *</label>
          <Controller
            name="companySlug"
            control={control}
            render={({ field }) => (
              <AppSelect
                inputId="companySlug"
                ariaLabel="Existing company"
                value={field.value ?? ""}
                onChange={(slug) => {
                  field.onChange(slug);
                  const company = COMPANIES.find((entry) => entry.slug === slug);
                  setValue("companyName", company?.name ?? "", { shouldValidate: true });
                }}
                options={[
                  { value: "", label: "Select from catalog..." },
                  ...COMPANIES.map((c) => ({ value: c.slug, label: c.name })),
                ]}
                isSearchable
              />
            )}
          />
          {errors.companySlug && <p className="form-error">{errors.companySlug.message}</p>}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="website">Company website</label>
        <input
          id="website"
          type="url"
          {...register("website")}
          placeholder="https://example.com"
          autoComplete="url"
          disabled={isNewCompanyBlocked}
        />
        {errors.website && <p className="form-error">{errors.website.message}</p>}
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="submitterName">Your name *</label>
          <input
            id="submitterName"
            type="text"
            {...register("submitterName")}
            autoComplete="name"
            disabled={isNewCompanyBlocked}
          />
          {errors.submitterName && <p className="form-error">{errors.submitterName.message}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="submitterEmail">Your email *</label>
          <input
            id="submitterEmail"
            type="email"
            {...register("submitterEmail")}
            autoComplete="email"
            disabled={isNewCompanyBlocked}
          />
          {errors.submitterEmail && <p className="form-error">{errors.submitterEmail.message}</p>}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="message">What should we add or change? *</label>
        <textarea
          id="message"
          rows={6}
          {...register("message")}
          placeholder="Describe category (product/service), headcount, domains, interview patterns, careers link, etc."
          disabled={isNewCompanyBlocked}
        />
        <p className="form-hint">Add at least 20 characters with the key details that help us verify the company.</p>
        {errors.message && <p className="form-error">{errors.message.message}</p>}
      </div>

      <label className="checkbox-card">
        <input type="checkbox" {...register("subscribeToUpdates")} disabled={isNewCompanyBlocked} />
        <span>
          Email me when new companies are verified or profiles are updated (what we added / changed).
          Update alerts — coming soon.
        </span>
      </label>

      <label className="checkbox-card">
        <input type="checkbox" {...register("isPortalRequest")} disabled={isNewCompanyBlocked} />
        <span>
          This is a portal request
          <span
            className="form-tooltip"
            tabIndex={0}
            role="img"
            aria-label="Leave this checked for a request submitted through this portal. Clear it only when entering a request received by email."
          >
            <IconInfo size={16} />
            <span role="tooltip">
              Leave this checked for a request submitted through this portal. Clear it only when entering a request received by email.
            </span>
          </span>
        </span>
      </label>

      <label className="checkbox-card">
        <input type="checkbox" {...register("acceptPolicy")} disabled={isNewCompanyBlocked} />
        <span>
          I accept the <Link href="/privacy-policy">Privacy Policy</Link> and{" "}
          <Link href="/terms-and-conditions">Terms and Conditions</Link>.
        </span>
      </label>
      {errors.acceptPolicy && <p className="form-error">{errors.acceptPolicy.message}</p>}

      <MathCaptchaField
        answer={captchaAnswer}
        onAnswerChange={(answer) => {
          setCaptchaAnswer(answer);
          clearDisplayedErrors();
        }}
        onTokenChange={setCaptchaToken}
        resetKey={captchaResetKey}
        error={captchaError}
        disabled={isNewCompanyBlocked}
      />

      {errorMessage && <p className="form-error banner">{errorMessage}</p>}

      <FormActions hint="No account needed. Every submission is reviewed against official sources before we update the catalog.">
        <button
          type="submit"
          className="form-submit-btn"
          disabled={
            status === "loading" ||
            !acceptPolicy ||
            (requestType === "add" && availability !== "available") ||
            (requestType === "edit" && !companySlug)
          }
        >
          {status === "loading" ? "Submitting…" : "Submit request"}
        </button>
      </FormActions>
    </form>
  );
}
