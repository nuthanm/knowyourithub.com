"use client";

import Link from "next/link";
import { ServiceInterruption } from "@/components/ServiceInterruption";

export default function PrototypeUnavailablePage() {
  return (
    <ServiceInterruption
      previewBanner={
        <div className="proto-status-banner">
          <span>Prototype preview — visitor view when a page cannot load</span>
          <Link href="/">Back to the live site</Link>
        </div>
      }
      onRetry={() => new Promise((resolve) => window.setTimeout(resolve, 1400))}
    />
  );
}
