"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ALL_SEARCH_ENTRIES,
  CATALOG_PROGRESS,
} from "@/lib/companies";
import { filterCompanyEntries, type CompanySearchEntry } from "@/lib/company-search";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";

type CompanySearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  location?: string;
  category?: CompanySearchEntry["category"] | "all";
  inputId?: string;
  variant?: "inline" | "nav";
  entries?: CompanySearchEntry[];
};

const SUGGESTION_LIMIT = 8;

function countMatchesByStatus(entries: CompanySearchEntry[]) {
  return {
    verified: entries.filter((e) => e.verificationStatus === "verified").length,
    inProgress: entries.filter((e) => e.verificationStatus === "in_progress").length,
    unverified: entries.filter((e) => e.verificationStatus === "unverified").length,
    total: entries.length,
  };
}

export function CompanySearchInput({
  value,
  onChange,
  location,
  category = "all",
  inputId = "company-search",
  variant = "inline",
  entries = ALL_SEARCH_ENTRIES,
}: CompanySearchInputProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];

    return filterCompanyEntries(entries, {
      query: q,
      location: location && location !== "all" ? location : undefined,
      category,
    }).slice(0, SUGGESTION_LIMIT);
  }, [value, location, category, entries]);

  const allMatches = useMemo(() => {
    const q = value.trim();
    if (!q) return [];

    return filterCompanyEntries(entries, {
      query: q,
      location: location && location !== "all" ? location : undefined,
      category,
    });
  }, [value, location, category, entries]);

  const matchCounts = useMemo(() => countMatchesByStatus(allMatches), [allMatches]);

  const groupedSuggestions = useMemo(() => {
    const groups = [
      { status: "verified" as const, label: "Verified", items: [] as CompanySearchEntry[] },
      { status: "in_progress" as const, label: "In progress", items: [] as CompanySearchEntry[] },
      { status: "unverified" as const, label: "Awaiting review", items: [] as CompanySearchEntry[] },
    ];

    for (const entry of suggestions) {
      const group = groups.find((g) => g.status === entry.verificationStatus);
      group?.items.push(entry);
    }

    return groups.filter((group) => group.items.length > 0);
  }, [suggestions]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showDropdown = open && value.trim().length > 0;

  return (
    <div className={`company-search-input company-search-input-${variant}`} ref={rootRef}>
      <label htmlFor={inputId} className="sr-only">
        Search companies
      </label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listId : undefined}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by company name…"
      />

      {showDropdown && (
        <div className="company-search-dropdown">
          {suggestions.length === 0 ? (
            <div className="company-search-empty">
              <p>No companies match “{value.trim()}”.</p>
              <Link
                href={`/submit?company=${encodeURIComponent(value.trim())}`}
                className="company-search-submit-cta"
                onClick={() => setOpen(false)}
              >
                Submit request
              </Link>
              <p className="company-search-empty-hint">
                Ask us to research and add this company — the name will be filled in for you.
              </p>
            </div>
          ) : (
            <>
              <p className="company-search-summary">
                <strong>{matchCounts.total}</strong> match{matchCounts.total === 1 ? "" : "es"}
                {matchCounts.total > SUGGESTION_LIMIT && (
                  <> · showing first {SUGGESTION_LIMIT}</>
                )}
                {matchCounts.verified > 0 && <> · {matchCounts.verified} verified</>}
                {matchCounts.inProgress > 0 && <> · {matchCounts.inProgress} in progress</>}
                {matchCounts.unverified > 0 && <> · {matchCounts.unverified} awaiting review</>}
              </p>
              <ul id={listId} role="listbox" aria-label="Company search results">
                {groupedSuggestions.map((group) => (
                  <li key={group.status} className="company-search-group">
                    <p className="company-search-group-label">{group.label}</p>
                    <ul>
                      {group.items.map((entry) => (
                        <li key={entry.slug} role="option" aria-selected={false}>
                          <Link
                            href={`/companies/${entry.slug}`}
                            className="company-search-option"
                            onClick={() => setOpen(false)}
                          >
                            <span className="company-search-option-name">{entry.name}</span>
                            <VerificationStatusTag status={entry.verificationStatus} size="sm" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
          {CATALOG_PROGRESS.inProgress + CATALOG_PROGRESS.unverified > 0 && suggestions.length > 0 && (
            <p className="company-search-hint">
              Directory lists <strong>{CATALOG_PROGRESS.verified} verified</strong> companies.
              Search also finds{" "}
              <strong>{CATALOG_PROGRESS.inProgress + CATALOG_PROGRESS.unverified}</strong> in our verification
              queue ({CATALOG_PROGRESS.inProgress} in progress, {CATALOG_PROGRESS.unverified} awaiting review) —
              not full profiles yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
