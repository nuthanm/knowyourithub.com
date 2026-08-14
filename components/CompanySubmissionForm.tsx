"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormActions } from "@/components/FormLayout";
import { COMPANIES, slugifyCompanyName } from "@/lib/companies";
import { getSubmitApiUrl } from "@/lib/site-meta";
import { submissionSchema, type SubmissionInput } from "@/lib/validators";
import { MathCaptchaField } from "./MathCaptchaField";
import { AppSelect } from "./AppSelect";

type FormValues = SubmissionInput;

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
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      requestType: initialSlug ? "edit" : "add",
      companySlug: initialSlug ?? "",
      companyName: initialCompanyName ?? "",
      acceptPolicy: undefined,
    },
  });

  const requestType = useWatch({ control, name: "requestType" });
  const companyName = useWatch({ control, name: "companyName" });

  useEffect(() => {
    setValue("formStartedAt", Date.now());
  }, [setValue]);

  async function onSubmit(values: FormValues) {
    setStatus("loading");
    setErrorMessage("");
    setCaptchaError("");

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
      const json = (await res.json()) as { ok?: boolean; error?: string; retryAfterSeconds?: number };
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
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unable to submit request.");
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

  return (
    <form className="app-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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

      <div className="form-field">
        <label htmlFor="companyName">Company name *</label>
        <input
          id="companyName"
          type="text"
          {...register("companyName")}
          placeholder="e.g. Razorpay"
          autoComplete="organization"
        />
        {errors.companyName && <p className="form-error">{errors.companyName.message}</p>}
      </div>

      {requestType === "edit" && (
        <div className="form-field">
          <label htmlFor="companySlug">Existing company (optional)</label>
          <Controller
            name="companySlug"
            control={control}
            render={({ field }) => (
              <AppSelect
                inputId="companySlug"
                ariaLabel="Existing company"
                value={field.value ?? ""}
                onChange={field.onChange}
                options={[
                  { value: "", label: "Select from catalog..." },
                  ...COMPANIES.map((c) => ({ value: c.slug, label: c.name })),
                ]}
                isSearchable
              />
            )}
          />
          <p className="form-hint">
            Or type a slug: {slugifyCompanyName(companyName || "company-name")}
          </p>
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
        />
        {errors.message && <p className="form-error">{errors.message.message}</p>}
      </div>

      <label className="checkbox-card">
        <input type="checkbox" {...register("subscribeToUpdates")} />
        <span>
          Email me when new companies are verified or profiles are updated (what we added / changed).
          Update alerts — coming soon.
        </span>
      </label>

      <label className="checkbox-card">
        <input type="checkbox" {...register("acceptPolicy")} />
        <span>
          I accept the <Link href="/privacy-policy">Privacy Policy</Link> and{" "}
          <Link href="/terms-and-conditions">Terms and Conditions</Link>.
        </span>
      </label>
      {errors.acceptPolicy && <p className="form-error">{errors.acceptPolicy.message}</p>}

      <MathCaptchaField
        answer={captchaAnswer}
        onAnswerChange={setCaptchaAnswer}
        onTokenChange={setCaptchaToken}
        resetKey={captchaResetKey}
        error={captchaError}
      />

      {errorMessage && <p className="form-error banner">{errorMessage}</p>}

      <FormActions hint="No account needed. Every submission is reviewed against official sources before we update the catalog.">
        <button type="submit" className="form-submit-btn" disabled={status === "loading"}>
          {status === "loading" ? "Submitting…" : "Submit request"}
        </button>
      </FormActions>
    </form>
  );
}
