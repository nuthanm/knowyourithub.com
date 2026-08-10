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
  const [location, setLocation] = useState("all");
  const [category, setCategory] = useState<CompanyCategory | "all">("all");
  const [domain, setDomain] = useState("all");
  const [view, setView] = useState<ViewMode>("list");

  const locations = useMemo(() => getCompanyLocations(VERIFIED_COMPANIES), []);
  const domains = useMemo(() => getCompanyDomains(VERIFIED_COMPANIES), []);

  const results = useMemo(() => {
    const filters = {
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
  }, [location, category, domain]);

  const selectedDomainLabel =
    domain === "all" ? undefined : domains.find((item) => item.value === domain)?.label;

  const grouped = useMemo(() => groupCompaniesByLetter(results), [results]);

  const availableLetters = useMemo(
    () => new Set(grouped.map((g) => g.letter)),
    [grouped],
  );

  return (
    <div className="companies-page">
      <div className="companies-toolbar-sticky">
        <div className="companies-toolbar companies-toolbar-filters-only">
          {!hasPipeline && (
            <p className="companies-toolbar-hint">
              Browse <strong>{CATEGORY_COUNTS.total} verified</strong> companies — sorted A–Z.
              Use the letter rail on the right to jump to any section.
            </p>
          )}
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
              <label className="filter-select-wrap">
                <span className="filter-select-label">Location</span>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  aria-label="Filter by location"
                >
                  <option value="all">All locations</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc.toLowerCase()}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-select-wrap">
                <span className="filter-select-label">Type</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CompanyCategory | "all")}
                  aria-label="Filter by company type"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-select-wrap">
                <span className="filter-select-label">Industry</span>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  aria-label="Filter by company industry"
                >
                  <option value="all">All industries</option>
                  {domains.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.preferred ? `Popular · ${item.label}` : item.label}
                    </option>
                  ))}
                </select>
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
