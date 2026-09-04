import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FormPageHeader, FormPanel } from "@/components/FormLayout";
import { PipelineQueue } from "@/components/PipelineQueue";

export const metadata = {
  title: "Review Queue — Know Your IT Hub",
  description: "Browse companies in progress and awaiting review before they become verified profiles.",
};

export default function ComingSoonPage() {
  return (
    <AppShell active="queue" wide>
      <div className="coming-soon-page">
        <FormPageHeader
          title="Review Queue"
          lead={
            <>
              Review company requests submitted by the community and our team. Each request is
              manually verified against official sources before it is published as a{" "}
              <Link href="/companies">verified company</Link>. To suggest another company,{" "}
              <Link href="/submit">submit a request</Link>.
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
