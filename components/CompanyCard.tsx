"use client";

import Link from "next/link";
import {
  CATEGORY_LABELS,
  type CompanyCategory,
  type CompanyProfile,
} from "@/lib/companies";
import type { CompanySearchEntry } from "@/lib/company-search";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";

function categoryClass(category: CompanyCategory) {
  if (category === "product") return "tag product";
  if (category === "service") return "tag service";
  if (category === "hybrid") return "tag hybrid";
  return "tag";
}

export function CompanyTileFromEntry({ entry }: { entry: CompanySearchEntry }) {
  if (entry.profile) {
    return <CompanyTile company={entry.profile} />;
  }

  return (
    <Link href={`/companies/${entry.slug}`} className="company-tile company-tile-pipeline">
      <div className="company-tile-top">
        <div>
          <h2>{entry.name}</h2>
          <p>{entry.note ?? entry.tagline}</p>
        </div>
        <VerificationStatusTag status={entry.verificationStatus} size="sm" />
      </div>
      <div className="company-tile-meta">
        {entry.category !== "unknown" && (
          <span className={categoryClass(entry.category)}>{CATEGORY_LABELS[entry.category]}</span>
        )}
        <span className="company-tile-loc">{VERIFICATION_LABELS_SHORT[entry.verificationStatus]}</span>
      </div>
    </Link>
  );
}

const VERIFICATION_LABELS_SHORT = {
  verified: "Verified profile",
  in_progress: "Verification in progress",
  unverified: "Awaiting review",
} as const;

export function CompanyListRowFromEntry({ entry }: { entry: CompanySearchEntry }) {
  if (entry.profile) {
    return <CompanyListRow company={entry.profile} />;
  }

  return (
    <Link href={`/companies/${entry.slug}`} className="company-list-row company-list-row-pipeline">
      <div className="company-list-main">
        <div className="company-list-title">
          <h2>{entry.name}</h2>
          <VerificationStatusTag status={entry.verificationStatus} size="sm" />
          {entry.category !== "unknown" && (
            <span className={categoryClass(entry.category)}>{CATEGORY_LABELS[entry.category]}</span>
          )}
        </div>
        <p className="company-list-tagline">{entry.note ?? entry.tagline}</p>
      </div>
      <div className="company-list-side">
        <span className="company-list-loc">{VERIFICATION_LABELS_SHORT[entry.verificationStatus]}</span>
        <span className="company-list-arrow" aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}

export function CompanyTile({ company }: { company: CompanyProfile }) {
  return (
    <Link href={`/companies/${company.slug}`} className="company-tile">
      <div className="company-tile-top">
        <div>
          <h2>{company.name}</h2>
          <p>{company.tagline}</p>
        </div>
        <VerificationStatusTag status="verified" size="sm" />
      </div>
      <div className="company-tile-meta">
        {company.category !== "unknown" && (
          <span className={categoryClass(company.category)}>{CATEGORY_LABELS[company.category]}</span>
        )}
        <span className="company-tile-loc">{company.hq}</span>
      </div>
      <div className="tag-row">
        {company.domains.slice(0, 3).map((d) => (
          <span key={d} className="mini-tag">
            {d}
          </span>
        ))}
      </div>
    </Link>
  );
}

export function CompanyListRow({ company }: { company: CompanyProfile }) {
  return (
    <Link href={`/companies/${company.slug}`} className="company-list-row">
      <div className="company-list-main">
        <div className="company-list-title">
          <h2>{company.name}</h2>
          <VerificationStatusTag status="verified" size="sm" />
          {company.category !== "unknown" && (
            <span className={categoryClass(company.category)}>{CATEGORY_LABELS[company.category]}</span>
          )}
        </div>
        <p className="company-list-tagline">{company.tagline}</p>
        <div className="company-list-tags">
          {company.domains.slice(0, 4).map((d) => (
            <span key={d} className="mini-tag">
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="company-list-side">
        <span className="company-list-loc">{company.hq}</span>
        <span className="company-list-arrow" aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}
