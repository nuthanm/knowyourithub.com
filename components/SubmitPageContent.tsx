"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CompanySubmissionForm } from "@/components/CompanySubmissionForm";
import { FormPageHeader, FormPanel } from "@/components/FormLayout";
import { DATA_YEAR } from "@/lib/companies";

export function SubmitPageContent() {
  const params = useSearchParams();
  const initialSlug = params.get("slug")?.trim() || undefined;
  const initialCompanyName = params.get("company")?.trim() || undefined;

  return (
    <div className="page-narrow">
      <FormPageHeader
        eyebrow="No sign-in required"
        title="Submit a company add or edit"
        lead={
          <>
            Help keep the <strong>{DATA_YEAR}</strong> catalog accurate. We review every request
            against <strong>official public sources</strong> before publishing. Read{" "}
            <Link href="/brief"><strong>The Brief</strong></Link> to see what this app covers. To protect the
            portal from spam, each network can submit up to eight requests in 10 minutes. If that
            limit is reached, wait for the time shown after submitting, or email{" "}
            <a href="mailto:inbox.nuthan@gmail.com"><strong>inbox.nuthan@gmail.com</strong></a> and we will add
            your request to the review queue.
          </>
        }
      />
      <FormPanel>
        <CompanySubmissionForm initialSlug={initialSlug} initialCompanyName={initialCompanyName} />
      </FormPanel>
    </div>
  );
}
