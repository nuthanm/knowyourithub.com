"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { GlobalCompanySearch } from "@/components/GlobalCompanySearch";
import type { CompanySearchEntry } from "@/lib/company-search";
import {
  IconBrief,
  IconClose,
  IconCompanies,
  IconFeedback,
  IconHome,
  IconMenu,
  IconQueue,
  IconSubmit,
} from "@/components/PortalIcons";

type NavKey = "home" | "companies" | "queue" | "brief" | "submit" | "feedback";

type AppHeaderProps = {
  active?: NavKey;
  trailing?: React.ReactNode;
  searchEntries?: CompanySearchEntry[];
};

const NAV_ITEMS: Array<{
  key: NavKey;
  href: string;
  label: string;
  Icon: typeof IconHome;
}> = [
  { key: "home", href: "/", label: "Home", Icon: IconHome },
  { key: "companies", href: "/companies", label: "Companies", Icon: IconCompanies },
  { key: "queue", href: "/coming-soon", label: "Review queue", Icon: IconQueue },
  { key: "brief", href: "/brief", label: "The Brief", Icon: IconBrief },
  { key: "submit", href: "/submit", label: "Submit request", Icon: IconSubmit },
  { key: "feedback", href: "/feedback", label: "Feedback", Icon: IconFeedback },
];

export function AppHeader({ active, trailing, searchEntries }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("nav-menu-open", menuOpen);
    return () => document.body.classList.remove("nav-menu-open");
  }, [menuOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="app-nav-inner">
        <Link href="/" className="app-brand" aria-label="Know Your IT Hub home">
          <BrandMark />
        </Link>

        <div className="app-nav-search">
          <GlobalCompanySearch variant="nav" entries={searchEntries} />
        </div>

        <div className="app-nav-end">
          <nav className="app-nav-icons" aria-label="Main">
            {NAV_ITEMS.map(({ key, href, label, Icon }) => (
              <Link
                key={key}
                href={href}
                className={`app-nav-icon-link ${active === key ? "active" : ""}`.trim()}
                aria-label={label}
                title={label}
              >
                <Icon size={19} />
                <span className="app-nav-icon-label">{label}</span>
              </Link>
            ))}
          </nav>

          {trailing && <div className="app-nav-trailing">{trailing}</div>}

          <button
            type="button"
            className="app-nav-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="app-mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="app-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="app-nav-search-mobile-bar">
        <GlobalCompanySearch
          variant="nav"
          inputId="global-company-search-bar"
          entries={searchEntries}
        />
      </div>

      <nav
        id="app-mobile-nav"
        className={`app-nav-mobile ${menuOpen ? "open" : ""}`.trim()}
        aria-label="Mobile"
        aria-hidden={!menuOpen}
      >
        <div className="app-nav-mobile-search">
          <GlobalCompanySearch
            variant="nav"
            inputId="global-company-search-mobile"
            entries={searchEntries}
          />
        </div>
        <ul className="app-nav-mobile-list">
          {NAV_ITEMS.map(({ key, href, label, Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className={active === key ? "active" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {trailing && <div className="app-nav-mobile-trailing">{trailing}</div>}
      </nav>
    </>
  );
}
