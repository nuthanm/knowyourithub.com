"use client";

import { useState } from "react";
import { CompanySearchInput } from "@/components/CompanySearchInput";
import { IconSearch } from "@/components/PortalIcons";
import type { CompanySearchEntry } from "@/lib/company-search";

type GlobalCompanySearchProps = {
  variant?: "nav" | "inline";
  inputId?: string;
  entries?: CompanySearchEntry[];
};

export function GlobalCompanySearch({
  variant = "inline",
  inputId = "global-company-search",
  entries,
}: GlobalCompanySearchProps) {
  const [query, setQuery] = useState("");

  return (
    <div className={`global-company-search global-company-search-${variant}`}>
      <IconSearch className="global-company-search-icon" size={17} />
      <CompanySearchInput
        value={query}
        onChange={setQuery}
        inputId={inputId}
        variant={variant}
        entries={entries}
      />
    </div>
  );
}
