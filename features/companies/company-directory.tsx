"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORY_COUNTS,
  CATEGORY_LABELS,
  CATALOG_PROGRESS,
  VERIFIED_COMPANIES,
  type CompanyCategory,
} from "@/lib/companies";
import { filterCompanies, getCompanyDomains, getCompanyLocations } from "@/lib/company-search";
import { CompanyListRowFromEntry, CompanyTileFromEntry } from "@/components/CompanyCard";
import { AlphabetIndex, groupCompaniesByLetter } from "@/components/AlphabetIndex";
import { AdSlot } from "@/components/AdSense";
import { AppSelect } from "@/components/AppSelect";

type ViewMode = "tiles" | "list";

const CATEGORY_OPTIONS: Array<{ id: CompanyCategory | "all"; label: string }> = [
  { id: "all", label: "All types" },
  { id: "product", label: "Product" },
  { id: "service", label: "Service" },
  { id: "hybrid", label: "Hybrid" },
];

const hasPipeline =
  CATALOG_PROGRESS.inProgress + CATALOG_PROGRESS.unverified > 0;

export function CompanyDirectory() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [category, setCategory] = useState<CompanyCategory | "all">("all");
  const [domain, setDomain] = useState("all");
  const [view, setView] = useState<ViewMode>("list");

  const locations = useMemo(() => getCompanyLocations(VERIFIED_COMPANIES), []);
  const domainSourceCompanies = useMemo(
    () =>
      filterCompanies(VERIFIED_COMPANIES, {
        category,
        location: location === "all" ? undefined : location,
        domain,
      }),
    [category, location, domain],
  );

  const domains = useMemo(() => getCompanyDomains(domainSourceCompanies), [domainSourceCompanies]);

  const companySearchOptions = useMemo(
    () =>
      domainSourceCompanies
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((company) => ({ value: company.slug, label: company.name })),
    [domainSourceCompanies],
  );

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setDomain("all");
  };

  const handleCategoryChange = (value: CompanyCategory | "all") => {
    setCategory(value);
    setDomain("all");
  };

  const selectedCompanySlug = useMemo(
    () =>
      companySearchOptions.find((option) => option.label.toLowerCase() === query.trim().toLowerCase())?.value ??
      "all",
    [companySearchOptions, query],
  );

  const effectiveQuery = selectedCompanySlug === "all" ? "" : query;

  const results = useMemo(() => {
    const filters = {
      query: effectiveQuery,
      location: location === "all" ? undefined : location,
      category,
      domain,
    };

    return filterCompanies(VERIFIED_COMPANIES, filters).map((company) => ({
      slug: company.slug,
      name: company.name,
      verificationStatus: company.verificationStatus,
      category: company.category,
      tagline: company.tagline,
      hq: company.hq,
      domains: company.domains,
      tags: company.tags,
      profile: company,
    }));
  }, [effectiveQuery, location, category, domain]);

  const selectedDomainLabel =
    domain === "all" ? undefined : domains.find((item) => item.value === domain)?.label;
  const hasQuery = effectiveQuery.trim().length > 0;

  const grouped = useMemo(() => groupCompaniesByLetter(results), [results]);

  const availableLetters = useMemo(
    () => new Set(grouped.map((g) => g.letter)),
    [grouped],
  );

  return (
    <div className="companies-page">
      <div className="companies-toolbar-sticky">
        <div className="companies-toolbar companies-toolbar-filters-only">
          {hasPipeline && (
            <p className="companies-toolbar-hint">
              Filters below apply to the <strong>{CATEGORY_COUNTS.total} verified</strong> companies in this
              directory. Header search can also find{" "}
              <strong>{CATALOG_PROGRESS.inProgress + CATALOG_PROGRESS.unverified}</strong> names still in our
              verification queue.
            </p>
          )}
          <div className="companies-toolbar-controls">
            <div className="companies-toolbar-filters">
              <label className="filter-select-wrap companies-toolbar-search">
                <span className="filter-select-label">Company</span>
                <AppSelect
                  ariaLabel="Search by company"
                  value={selectedCompanySlug}
                  onChange={(nextValue) => {
                    if (nextValue === "all") {
                      setQuery("");
                      return;
                    }
                    const selected = companySearchOptions.find((option) => option.value === nextValue);
                    setQuery(selected?.label ?? "");
                  }}
                  options={[
                    { value: "all", label: "Search by company" },
                    ...companySearchOptions,
                  ]}
                  size="compact"
                />
              </label>
              <label className="filter-select-wrap">
                <span className="filter-select-label">Location</span>
                <AppSelect
                  ariaLabel="Filter by location"
                  value={location}
                  onChange={handleLocationChange}
                  options={[
                    { value: "all", label: "All locations" },
                    ...locations.map((loc) => ({ value: loc.toLowerCase(), label: loc })),
                  ]}
                  size="compact"
                />
              </label>
              <label className="filter-select-wrap">
                <span className="filter-select-label">Type</span>
                <AppSelect
                  ariaLabel="Filter by company type"
                  value={category}
                  onChange={(nextValue) => handleCategoryChange(nextValue as CompanyCategory | "all")}
                  options={CATEGORY_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
                  isSearchable={false}
                  size="compact"
                />
              </label>
              <label className="filter-select-wrap">
                <span className="filter-select-label">Industry</span>
                <AppSelect
                  ariaLabel="Filter by company industry"
                  value={domain}
                  onChange={setDomain}
                  options={[
                    { value: "all", label: "All industries" },
                    ...domains.map((item) => ({
                      value: item.value,
                      label: item.preferred ? `Popular · ${item.label}` : item.label,
                    })),
                  ]}
                  size="compact"
                />
              </label>
            </div>
            <div className="view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={view === "tiles" ? "active" : ""}
                onClick={() => setView("tiles")}
                aria-pressed={view === "tiles"}
              >
                Tiles
              </button>
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
              >
                List
              </button>
            </div>
          </div>
        </div>
        <p className="companies-results-bar">
          Showing <strong>{results.length}</strong> of {CATEGORY_COUNTS.total} verified companies
          {hasQuery && <> · Search: {effectiveQuery.trim()}</>}
          {category !== "all" && <> · {CATEGORY_LABELS[category]}</>}
          {location !== "all" && <> · {location}</>}
          {selectedDomainLabel && <> · {selectedDomainLabel}</>}
        </p>
      </div>

      <AdSlot />

      {results.length === 0 ? (
        <div className="empty-state">
          <p>No companies match your filters.</p>
          <Link href="/submit" className="app-btn primary">
            Request this company
          </Link>
        </div>
      ) : (
        <div className="companies-directory-layout">
          <div className="companies-directory-main">
            {grouped.map(({ letter, items }) => (
              <section
                key={letter}
                id={`companies-${letter}`}
                className="companies-alpha-section"
                aria-labelledby={`companies-heading-${letter}`}
              >
                <h2 id={`companies-heading-${letter}`} className="companies-alpha-letter">
                  {letter}
                </h2>
                {view === "tiles" ? (
                  <ul className="company-tile-grid">
                    {items.map((entry) => (
                      <li key={entry.slug}>
                        <CompanyTileFromEntry entry={entry} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="company-list">
                    {items.map((entry) => (
                      <li key={entry.slug}>
                        <CompanyListRowFromEntry entry={entry} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          <AlphabetIndex availableLetters={availableLetters} />
        </div>
      )}
    </div>
  );
}
