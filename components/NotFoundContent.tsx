"use client";

import Link from "next/link";
import { GlobalCompanySearch } from "@/components/GlobalCompanySearch";
import type { CompanySearchEntry } from "@/lib/company-search";

export function NotFoundContent({ searchEntries }: { searchEntries?: CompanySearchEntry[] }) {
  return (
    <div className="not-found-page">
      <p className="eyebrow">Page not found</p>
      <h1 className="page-title">This page is not in the catalog</h1>
      <p className="page-lead">
        The link may be outdated. Search for a company, or browse verified profiles.
      </p>
      <div className="not-found-search">
        <GlobalCompanySearch
          variant="nav"
          inputId="not-found-company-search"
          entries={searchEntries}
        />
      </div>
      <div className="not-found-actions">
        <Link href="/companies" className="app-btn outline lg">
          Browse companies
        </Link>
        <Link href="/" className="app-btn outline lg">
          Go to home
        </Link>
      </div>
    </div>
  );
}
