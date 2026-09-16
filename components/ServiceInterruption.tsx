"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SITE_NAME } from "@/lib/site-meta";

type ServiceInterruptionProps = {
  onRetry: () => void | Promise<void>;
  previewBanner?: ReactNode;
};

export function ServiceInterruption({ onRetry, previewBanner }: ServiceInterruptionProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    document.title = `We are working on this — ${SITE_NAME}`;
  }, []);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="status-interrupt">
      {previewBanner}
      <header className="status-interrupt-nav">
        <Link href="/" className="app-brand">
          <BrandMark />
        </Link>
      </header>

      <main className="status-interrupt-main">
        <div className="status-interrupt-card">
          <div className="status-interrupt-orb" aria-hidden>
            <span className="status-interrupt-ring" />
            <span className="status-interrupt-ring inner" />
            <BrandMark />
          </div>

          <p className="status-interrupt-eyebrow">A short pause</p>
          <h1>We are working on this right now</h1>
          <p className="status-interrupt-lead">
            This page hit a technical glitch. Nothing is wrong on your side. Please wait a
            moment and try again — we appreciate your patience.
          </p>

          <ul className="status-interrupt-points">
            <li>Our team is already looking into it</li>
            <li>Your visit is safe; this is on us</li>
            <li>Most of the directory should still open as usual</li>
          </ul>

          <div className="status-interrupt-actions">
            <button
              type="button"
              className="app-btn primary lg"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? "Checking again" : "Try again"}
            </button>
            <Link href="/companies" className="app-btn outline lg">
              Browse companies
            </Link>
          </div>

          <p className="status-interrupt-note" aria-live="polite">
            {retrying ? (
              "Checking this page again. Please wait a moment."
            ) : (
              <>
                If this continues, send us a note from{" "}
                <Link href="/contact">Contact</Link>. We read every message.
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
