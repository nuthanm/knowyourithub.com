import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SubscriberPill } from "@/components/SubscriberPill";
import { getCatalogCompanies } from "@/lib/catalog-db";
import { ALL_SEARCH_ENTRIES } from "@/lib/companies";
import { companyProfileToEntry } from "@/lib/company-search";
import stats from "@/data/site-stats.json";

type AppShellProps = {
  children: React.ReactNode;
  active?: "home" | "companies" | "queue" | "brief" | "submit" | "feedback" | "about" | "contact";
  wide?: boolean;
};

export async function AppShell({ children, active, wide }: AppShellProps) {
  const showSubscriberPill =
    stats.showSubscriberCount && stats.subscriberCount > 0;
  const catalogEntries = (await getCatalogCompanies()).map(companyProfileToEntry);
  const catalogSlugs = new Set(catalogEntries.map((entry) => entry.slug));
  const searchEntries = [
    ...catalogEntries,
    ...ALL_SEARCH_ENTRIES.filter((entry) => !catalogSlugs.has(entry.slug)),
  ];

  return (
    <div className="app-shell">
      <header className="app-nav">
        <AppHeader
          active={active === "about" || active === "contact" ? undefined : active}
          trailing={showSubscriberPill ? <SubscriberPill /> : undefined}
          searchEntries={searchEntries}
        />
      </header>
      <main className={`app-main ${wide ? "app-main-wide" : ""}`.trim()}>{children}</main>
      <footer className="app-footer">
        <p>
          Know your company type before you apply — manually verified profiles from official sources.
        </p>
        <div className="app-footer-links">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/companies">Companies</Link>
          <Link href="/coming-soon">Review queue</Link>
          <Link href="/brief">The Brief</Link>
          <Link href="/submit">Submit request</Link>
          <Link href="/feedback">Feedback</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-and-conditions">Terms</Link>
        </div>
        {showSubscriberPill && <SubscriberPill />}
        <p className="app-footer-note">Community directory. Not affiliated with listed companies.</p>
      </footer>
    </div>
  );
}
