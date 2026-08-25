import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { FormPageHeader, FormPanel } from "@/components/FormLayout";
import { PipelineQueue } from "@/components/PipelineQueue";
import { CATALOG_PROGRESS } from "@/lib/companies";

export const metadata = {
  title: "Review queue — Know Your IT Hub",
  description: "Browse companies in progress and awaiting review before they become verified profiles.",
};

export default function ComingSoonPage() {
  const totalInQueue = CATALOG_PROGRESS.inProgress + CATALOG_PROGRESS.unverified;

  return (
    <AppShell active="queue" wide>
      <div className="coming-soon-page">
        <FormPageHeader
          eyebrow="Transparency"
          title="Review queue"
          lead={
            <>
              {totalInQueue} companies are being researched before they get a verified profile.
              Browse the grid below — filter by status or type, and suggest official sources if you
              have them.
            </>
          }
        />

        <FormPanel>
          <Suspense fallback={<p className="pipeline-loading">Loading review queue…</p>}>
            <PipelineQueue />
          </Suspense>
        </FormPanel>
      </div>
    </AppShell>
  );
}
