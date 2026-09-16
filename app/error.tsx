"use client";

import { useEffect } from "react";
import { ServiceInterruption } from "@/components/ServiceInterruption";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ServiceInterruption onRetry={reset} />;
}
