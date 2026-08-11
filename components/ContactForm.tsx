"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormActions } from "@/components/FormLayout";
import { contactSchema, type ContactInput } from "@/lib/validators";
import { getContactApiUrl } from "@/lib/site-meta";
import { MathCaptchaField } from "./MathCaptchaField";
import { AppSelect } from "./AppSelect";

const TOPIC_OPTIONS: Array<{ value: ContactInput["topic"]; label: string }> = [
  { value: "general", label: "General question" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "partnership", label: "Partnership or media" },
  { value: "other", label: "Something else" },
];

export function ContactForm() {
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { acceptPolicy: undefined, topic: "general" },
  });

  useEffect(() => {
    setValue("formStartedAt", Date.now());
  }, [setValue]);

  async function onSubmit(values: ContactInput) {
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
      const res = await fetch(getContactApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          captchaToken,
          captchaAnswer: answer,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Unable to send message.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unable to send message.");
      setCaptchaAnswer("");
      setCaptchaToken("");
      setCaptchaResetKey((k) => k + 1);
    }
  }

  if (status === "success") {
    return (
      <div className="form-success">
        <h2>Message sent</h2>
        <p>Thanks for reaching out. We read every message and will reply when a response is needed.</p>
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
        <label htmlFor="contactWebsiteField">Website</label>
        <input id="contactWebsiteField" tabIndex={-1} autoComplete="off" {...register("websiteField")} />
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="contactName">Your name *</label>
          <input id="contactName" type="text" {...register("name")} autoComplete="name" />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>
        <div className="form-field">
          <label htmlFor="contactEmail">Your email *</label>
          <input id="contactEmail" type="email" {...register("email")} autoComplete="email" />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="contactTopic">Topic *</label>
        <Controller
          name="topic"
          control={control}
          render={({ field }) => (
            <AppSelect
              inputId="contactTopic"
              ariaLabel="Topic"
              value={field.value}
              onChange={field.onChange}
              options={TOPIC_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              isSearchable={false}
            />
          )}
        />
        {errors.topic && <p className="form-error">{errors.topic.message}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="contactMessage">Message *</label>
        <textarea
          id="contactMessage"
          rows={6}
          {...register("message")}
          placeholder="How can we help? Include enough detail for privacy or data requests."
        />
        {errors.message && <p className="form-error">{errors.message.message}</p>}
      </div>

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

      <FormActions hint="Need a company added or corrected? Use Submit request instead — it goes straight to the catalog queue.">
        <button type="submit" className="form-submit-btn" disabled={status === "loading"}>
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
      </FormActions>
    </form>
  );
}
