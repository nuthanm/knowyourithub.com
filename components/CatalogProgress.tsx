import Link from "next/link";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";

type CatalogProgressProps = {
  verified: number;
  inProgress: number;
  unverified: number;
  catalogUpdated: string;
};

export function CatalogProgress({ verified, inProgress, unverified, catalogUpdated }: CatalogProgressProps) {
  const hasPipeline = inProgress + unverified > 0;
  const totalTracked = verified + inProgress + unverified;
  const verifiedPercent = hasPipeline
    ? Math.round((verified / totalTracked) * 100)
    : 100;

  return (
    <section className="catalog-progress" aria-label="Catalog overview">
      <div className="catalog-progress-top">
        <div className="catalog-progress-intro">
          <span className="landing-eyebrow">Transparency</span>
          <h2>Our catalog</h2>
          <p>
            {hasPipeline ? (
              <>
                We show our work. Only <strong>{verified} verified</strong> companies
                have full profiles today. Search also surfaces{" "}
                <strong>{inProgress + unverified}</strong> names still
                in our review queue — clearly labelled, not presented as verified.
              </>
            ) : (
              <>
                Every company listed here is <strong>manually verified</strong> against official sources.
                We currently publish <strong>{verified} full profiles</strong> — no
                placeholder or draft listings.
              </>
            )}
          </p>
        </div>
        <div className="catalog-progress-meter" aria-label={`${verifiedPercent}% verified`}>
          <div className="catalog-progress-ring">
            <div className="catalog-progress-ring-inner">
              <strong>{verified}</strong>
              <span>{hasPipeline ? "verified" : "live profiles"}</span>
            </div>
          </div>
          {hasPipeline && (
            <div className="landing-progress-track catalog-progress-track">
              <div className="landing-progress-fill" style={{ width: `${verifiedPercent}%` }} />
            </div>
          )}
          <p>
            {hasPipeline
              ? `${verified} of ${totalTracked} tracked · updated ${catalogUpdated}`
              : `All verified · updated ${catalogUpdated}`}
          </p>
        </div>
      </div>

      <div className={`catalog-stat-row${hasPipeline ? "" : " catalog-stat-row-compact"}`}>
        <Link href="/companies" className="catalog-stat verified catalog-stat-tile">
          <VerificationStatusTag status="verified" size="sm" />
          <strong>{verified}</strong>
          <h3>Verified</h3>
          <p>Live with official source links</p>
          <span className="catalog-stat-cta">Browse directory →</span>
        </Link>
        {hasPipeline && (
          <>
            <Link href="/coming-soon" className="catalog-stat in-progress catalog-stat-tile">
              <VerificationStatusTag status="in_progress" size="sm" />
              <strong>{inProgress}</strong>
              <h3>In progress</h3>
              <p>Being checked on official pages</p>
              <span className="catalog-stat-cta">View queue →</span>
            </Link>
            <Link href="/coming-soon" className="catalog-stat unverified catalog-stat-tile">
              <VerificationStatusTag status="unverified" size="sm" />
              <strong>{unverified}</strong>
              <h3>Awaiting review</h3>
              <p>Not published until validated</p>
              <span className="catalog-stat-cta">View queue →</span>
            </Link>
          </>
        )}
      </div>

      <div className="catalog-progress-foot">
        <p>
          {hasPipeline
            ? "Want a company prioritised? Submit it — we review against official sources in order received."
            : "Missing a company? Submit a request — we add profiles only after verifying official sources."}
        </p>
        <Link href="/submit" className="landing-btn secondary">
          Submit request
        </Link>
      </div>
    </section>
  );
}
