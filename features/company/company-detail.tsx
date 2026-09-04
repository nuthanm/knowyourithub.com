import Link from "next/link";
import {
  CATEGORY_LABELS,
  DATA_YEAR,
  getCitationSources,
  getCompanyBySlug,
  getHqMapUrl,
  getOfficeCityPreview,
  getOfficialPresenceLink,
  isMainFounder,
  shouldShowLocationsSection,
  sortLeadership,
  type CompanyProfile,
} from "@/lib/companies";
import { AdSlot } from "@/components/AdSense";
import { VerifiedStamp } from "@/components/VerifiedStamp";
import {
  IconCareers,
  IconEdit,
  IconGlobe,
  IconLink,
  IconLinkedIn,
  IconMapPin,
  IconPackage,
  IconTag,
  IconTwitter,
  IconUsers,
  IconArrowLeft,
} from "@/components/PortalIcons";

function categoryClass(category: CompanyProfile["category"]) {
  if (category === "product") return "tag product";
  if (category === "service") return "tag service";
  if (category === "hybrid") return "tag hybrid";
  return "tag";
}

function leaderInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ProfileCard({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`profile-card ${className ?? ""}`.trim()}>
      <h2 className="profile-card-title">{title}</h2>
      <div className="profile-card-body">{children}</div>
    </section>
  );
}

function ProfileIconLink({
  href,
  label,
  icon,
  external,
  primary,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
  primary?: boolean;
}) {
  const className = `profile-icon-link ${primary ? "primary" : ""}`.trim();

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <span className="profile-icon-link-icon">{icon}</span>
        <span>{label}</span>
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      <span className="profile-icon-link-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function CompanyDetail({ company }: { company: CompanyProfile }) {
  const city = company.hq.split(",")[0]?.trim() ?? company.hq;
  const citationSources = getCitationSources(company);
  const hqMapUrl = getHqMapUrl(company);
  const showLocations = shouldShowLocationsSection(company);
  const presenceLink = getOfficialPresenceLink(company);
  const { preview: officeCities, remaining: moreCities } = getOfficeCityPreview(company);
  const officeCountries = company.officeCountries ?? [];
  const leadership = company.leadership ? sortLeadership(company.leadership) : [];

  return (
    <article className="company-profile">
      <div className="profile-hero">
        <div className="profile-hero-main">
          <div className="profile-hero-badges">
            <VerifiedStamp size="md" />
            {company.category !== "unknown" && (
              <span className={categoryClass(company.category)}>{CATEGORY_LABELS[company.category]}</span>
            )}
          </div>
          <h1>{company.name}</h1>
          <p className="profile-tagline">{company.tagline}</p>
          <p className="profile-meta">
            <span className="profile-meta-item">
              <IconMapPin size={14} />
              {city}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Data {DATA_YEAR}
              {company.lastVerified && (
                <>
                  {" "}
                  · Verified <time dateTime={company.lastVerified}>{company.lastVerified}</time>
                </>
              )}
            </span>
          </p>
        </div>
      </div>

      <div className="profile-stats">
        {company.founded && (
          <div className="profile-stat">
            <span className="profile-stat-label">Founded</span>
            <strong>{company.founded}</strong>
          </div>
        )}
        <div className="profile-stat">
          <span className="profile-stat-label">Headquarters</span>
          <strong>{company.hq}</strong>
          <a
            href={hqMapUrl}
            target="_blank"
            rel="noreferrer"
            className="profile-stat-link"
          >
            Open in Maps
          </a>
        </div>
        {(company.headcountIndia || company.headcountGlobal) && (
          <div className="profile-stat">
            <span className="profile-stat-label">Headcount</span>
            <strong>{company.headcountIndia ?? company.headcountGlobal}</strong>
          </div>
        )}
        {company.onsitePolicy && (
          <div className="profile-stat">
            <span className="profile-stat-label">Work model</span>
            <strong>{company.onsitePolicy}</strong>
          </div>
        )}
      </div>

      <AdSlot />

      <div className="profile-layout profile-layout-three">
        <aside className="profile-left-nav">
          <div className="profile-left-panel">
            <h2 className="profile-left-title">Quick links</h2>
            <div className="profile-icon-links">
              <ProfileIconLink
                href={company.website}
                label="Website"
                icon={<IconGlobe size={17} />}
                external
                primary
              />
              {company.careersUrl && (
                <ProfileIconLink
                  href={company.careersUrl}
                  label="Careers"
                  icon={<IconCareers size={17} />}
                  external
                />
              )}
              {company.linkedin && (
                <ProfileIconLink
                  href={company.linkedin}
                  label="LinkedIn"
                  icon={<IconLinkedIn size={17} />}
                  external
                />
              )}
              {company.twitter && (
                <ProfileIconLink
                  href={company.twitter}
                  label="X / Twitter"
                  icon={<IconTwitter size={17} />}
                  external
                />
              )}
              <ProfileIconLink
                href={`/submit?slug=${company.slug}`}
                label="Suggest edit"
                icon={<IconEdit size={17} />}
              />
            </div>
          </div>

          {leadership.length > 0 && (
            <div className="profile-left-panel profile-leaders-panel">
              <h2 className="profile-left-title">
                <IconUsers size={16} />
                Leadership
              </h2>
              <ul className="profile-leaders-list">
                {leadership.map((leader) => (
                  <li
                    key={leader.name}
                    className={isMainFounder(leader.role) ? "profile-leader-founder" : undefined}
                  >
                    <span className="profile-leader-avatar" aria-hidden="true">
                      {leaderInitials(leader.name)}
                    </span>
                    <div className="profile-leader-copy">
                      <strong>{leader.name}</strong>
                      <span>{leader.role}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="profile-main">
          <ProfileCard id="about" title="About">
            <p className="profile-text">{company.description}</p>
            {company.vision && (
              <div className="profile-subblock">
                <h3>Vision</h3>
                <p className="profile-text">{company.vision}</p>
              </div>
            )}
          </ProfileCard>

          {showLocations && (
            <ProfileCard id="locations" title="Locations">
              <div className="profile-locations-card">
                <div className="profile-location-hq">
                  <span className="profile-location-hq-icon" aria-hidden="true">
                    <IconMapPin size={18} />
                  </span>
                  <div>
                    <p className="profile-location-hq-label">Headquarters</p>
                    <strong>{company.hq}</strong>
                  </div>
                </div>

                <div className="profile-location-groups">
                  {officeCountries.length > 0 && (
                    <div className="profile-location-group">
                      <p className="profile-location-label">Countries</p>
                      <div className="profile-chip-grid">
                        {officeCountries.map((country) => (
                          <span key={country} className="profile-location-chip muted">
                            {country}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {officeCities.length > 0 && (
                    <div className="profile-location-group">
                      <p className="profile-location-label">
                        {officeCities.length > 1 ? "Hiring cities" : "Office"}
                      </p>
                      <div className="profile-chip-grid">
                        {officeCities.map((officeCity) => (
                          <span key={officeCity} className="profile-location-chip">
                            <IconMapPin size={13} />
                            {officeCity}
                          </span>
                        ))}
                      </div>
                      {moreCities > 0 && !company.totalOfficeLocations && (
                        <p className="profile-location-remainder">
                          +{moreCities} more on the official site
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {presenceLink && (
                  <a
                    href={presenceLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="profile-outbound-link"
                  >
                    <IconLink size={15} />
                    {presenceLink.label}
                  </a>
                )}
              </div>
            </ProfileCard>
          )}

          <ProfileCard id="domains" title="Domains & tags">
            <div className="profile-taxonomy">
              <div className="profile-taxonomy-group">
                <p className="profile-taxonomy-label">
                  <IconTag size={14} />
                  Domains
                </p>
                <div className="profile-chip-grid">
                  {company.domains.map((domain) => (
                    <span key={domain} className="profile-domain-chip">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
              {company.tags.length > 0 && (
                <div className="profile-taxonomy-group">
                  <p className="profile-taxonomy-label">Tags</p>
                  <div className="profile-chip-grid">
                    {company.tags.map((tag) => (
                      <span key={tag} className="profile-tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ProfileCard>

          {company.products && company.products.length > 0 && (
            <ProfileCard id="products" title="Products">
              <ul className="profile-product-grid">
                {company.products.map((product) => (
                  <li key={product} className="profile-product-item">
                    <span className="profile-product-icon" aria-hidden="true">
                      <IconPackage size={16} />
                    </span>
                    <span>{product}</span>
                  </li>
                ))}
              </ul>
            </ProfileCard>
          )}

          {company.services && company.services.length > 0 && (
            <ProfileCard id="services" title="Services">
              <ul className="profile-list">
                {company.services.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </ProfileCard>
          )}
        </div>

        <aside className="profile-sidebar">
          {company.headcountNote && (
            <ProfileCard title="Note" className="profile-note-card">
              <p className="profile-text small">{company.headcountNote}</p>
            </ProfileCard>
          )}

          {citationSources.length > 0 && (
            <ProfileCard title="Sources">
              <ul className="profile-source-links">
                {citationSources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      <IconLink size={16} />
                      <span>{s.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </ProfileCard>
          )}

          <div className="profile-cta-card">
            <h2>Something outdated?</h2>
            <p>Help keep this {DATA_YEAR} profile accurate for everyone.</p>
            <Link href={`/submit?slug=${company.slug}`} className="form-submit-btn">
              <IconEdit size={16} />
              Submit edit request
            </Link>
          </div>
        </aside>
      </div>

      <p className="profile-back">
        <Link href="/companies">
          <IconArrowLeft size={16} />
          Back to all companies
        </Link>
      </p>
    </article>
  );
}

export function getCompanyDetail(slug: string) {
  return getCompanyBySlug(slug);
}
