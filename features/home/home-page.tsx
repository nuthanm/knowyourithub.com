"use client";

import Link from "next/link";
import {
  CATEGORY_LABELS,
  type CompanyCategory,
  type CompanyProfile,
} from "@/lib/companies";
import { CatalogProgress } from "@/components/CatalogProgress";
import { CategoryGuide } from "@/components/CategoryGuide";
import { DataNotice } from "@/components/DataNotice";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";
import {
  IconArrowRight,
  IconBrief,
  IconNodes,
  IconPackage,
  IconRefresh,
  IconShieldCheck,
  IconSubmit,
  IconTarget,
  IconUsers,
} from "@/components/PortalIcons";

const CATALOG_GOAL = 1000;

const TRUST_PILLARS = [
  {
    title: "Manual verification",
    body: "Every verified profile is checked by a human against official company pages — not scraped blindly.",
    icon: IconUsers,
  },
  {
    title: "Source-linked data",
    body: "Headcount, work model, and company type link back to public sources you can open and verify yourself.",
    icon: IconShieldCheck,
  },
  {
    title: "Community corrections",
    body: "Spot something outdated? Submit an edit without sign-in — we review against official sources before updating.",
    icon: IconSubmit,
  },
] as const;

function categoryClass(category: CompanyCategory) {
  if (category === "product") return "tag product";
  if (category === "service") return "tag service";
  if (category === "hybrid") return "tag hybrid";
  return "tag";
}

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

type HomePageProps = {
  companies: CompanyProfile[];
  metadata: { dataYear: string | number; catalogUpdated: string };
  queueCounts?: { awaitingReview: number; inProgress: number };
};

export function HomePage({
  companies,
  metadata,
  queueCounts = { awaitingReview: 0, inProgress: 0 },
}: HomePageProps) {
  const verifiedCompanies = companies.filter((company) => company.verificationStatus === "verified");
  const featured = verifiedCompanies.slice(0, 3);
  const verified = verifiedCompanies.length;
  const categoryCounts = verifiedCompanies.reduce(
    (counts, company) => {
      if (company.category !== "unknown") counts[company.category] += 1;
      return counts;
    },
    { product: 0, service: 0, hybrid: 0 },
  );
  const { awaitingReview: unverified, inProgress } = queueCounts;
  const trustFeatures = [
    { title: "Verified manually", body: "Human-verified, not auto-tagged.", icon: IconShieldCheck },
    { title: "Job seeker first", body: "Clarity before you apply.", icon: IconTarget },
    { title: "Updated regularly", body: `Live catalog · ${metadata.catalogUpdated}.`, icon: IconRefresh },
  ] as const;
  const goalPercent = Math.min(100, Math.round((verified / CATALOG_GOAL) * 100));
  const categoryTotal = Math.max(1, verified);

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Company directory · {metadata.dataYear}</span>
          <h1>
            Know if a company is product or service{" "}
            <span>before you apply</span>
          </h1>
          <p className="landing-lead">
            We verify and classify IT companies as Product, Service, or Hybrid — so you can apply with
            confidence.
          </p>
          <div className="landing-hero-actions">
            <Link href="/companies" className="landing-btn primary">
              Browse {verified} verified companies
              <IconArrowRight size={16} />
            </Link>
            <Link href="/brief" className="landing-btn secondary">
              Read the brief
            </Link>
          </div>
          <ul className="landing-trust-features" aria-label="Why Know Your IT Hub">
            {trustFeatures.map(({ title, body, icon: Icon }) => (
              <li key={title}>
                <span className="landing-trust-feature-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <em>{body}</em>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="landing-hero-panel" aria-label="Catalog snapshot">
          <div className="landing-panel-head">
            <span className="landing-panel-label">Live catalog</span>
            <span className="landing-live-pill">
              <span className="landing-live-dot" aria-hidden="true" />
              Live
            </span>
          </div>
          <div className="landing-panel-score">
            <strong>{verified}</strong>
            <span>verified companies live today</span>
          </div>
          <div className="landing-progress-track" aria-hidden="true">
            <div className="landing-progress-fill" style={{ width: `${goalPercent}%` }} />
          </div>
          <p className="landing-panel-meta landing-panel-goal">
            <span>Goal: {CATALOG_GOAL.toLocaleString()} companies</span>
            <span>{goalPercent}%</span>
          </p>
          <div className="landing-panel-stats">
            <div className="is-product">
              <span className="landing-panel-stat-icon" aria-hidden="true">
                <IconPackage size={16} />
              </span>
              <span className="landing-panel-stat-label">Product</span>
              <strong>{categoryCounts.product}</strong>
              <em>{pct(categoryCounts.product, categoryTotal)}</em>
            </div>
            <div className="is-service">
              <span className="landing-panel-stat-icon" aria-hidden="true">
                <IconUsers size={16} />
              </span>
              <span className="landing-panel-stat-label">Service</span>
              <strong>{categoryCounts.service}</strong>
              <em>{pct(categoryCounts.service, categoryTotal)}</em>
            </div>
            <div className="is-hybrid">
              <span className="landing-panel-stat-icon" aria-hidden="true">
                <IconNodes size={16} />
              </span>
              <span className="landing-panel-stat-label">Hybrid</span>
              <strong>{categoryCounts.hybrid}</strong>
              <em>{pct(categoryCounts.hybrid, categoryTotal)}</em>
            </div>
          </div>
          <Link href="/companies" className="landing-panel-cta">
            View all companies
            <IconArrowRight size={16} />
          </Link>
        </aside>
      </section>

      <CategoryGuide />

      <section className="landing-trust-row" aria-label="How Know Your IT Hub works">
        {TRUST_PILLARS.map(({ title, body, icon: Icon }) => (
          <article key={title} className="landing-trust-card">
            <span className="landing-trust-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="landing-featured" aria-labelledby="featured-heading">
        <div className="landing-section-head">
          <div>
            <h2 id="featured-heading">Featured verified profiles</h2>
            <p>Real companies with source-linked data — not dummy listings.</p>
          </div>
          <Link href="/companies" className="landing-text-link">
            View all →
          </Link>
        </div>
        <ul className="landing-featured-grid">
          {featured.map((company) => (
            <li key={company.slug}>
              <Link href={`/companies/${company.slug}`} className="landing-company-card">
                <div className="landing-company-card-top">
                  <h3>{company.name}</h3>
                  <VerificationStatusTag status="verified" size="sm" />
                </div>
                <p>{company.tagline}</p>
                <div className="landing-company-card-meta">
                  {company.category !== "unknown" && (
                    <span className={categoryClass(company.category)}>
                      {CATEGORY_LABELS[company.category]}
                    </span>
                  )}
                  <span>{company.hq.split(",")[0]?.trim()}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DataNotice dataYear={metadata.dataYear} catalogUpdated={metadata.catalogUpdated} />
      <CatalogProgress
        verified={verified}
        inProgress={inProgress}
        unverified={unverified}
        catalogUpdated={metadata.catalogUpdated}
      />

      <section className="landing-cta">
        <div className="landing-cta-copy">
          <h2>Help us keep this catalog honest</h2>
          <p>
            Missing a company or see outdated info? Submit a request — we validate every change
            against official pages before publishing.
          </p>
        </div>
        <div className="landing-cta-actions">
          <Link href="/submit" className="landing-btn primary">
            <IconSubmit size={16} />
            Submit request
          </Link>
          <Link href="/brief" className="landing-btn secondary">
            <IconBrief size={16} />
            The Brief
          </Link>
        </div>
      </section>
    </div>
  );
}
