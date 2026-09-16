import { AppShell } from "@/components/AppShell";
import { NotFoundContent } from "@/components/NotFoundContent";
import { getCatalogCompanies } from "@/lib/catalog-db";
import { ALL_SEARCH_ENTRIES } from "@/lib/companies";
import { companyProfileToEntry } from "@/lib/company-search";

export const metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  let searchEntries = ALL_SEARCH_ENTRIES;
  try {
    const catalogEntries = (await getCatalogCompanies()).map(companyProfileToEntry);
    const catalogSlugs = new Set(catalogEntries.map((entry) => entry.slug));
    searchEntries = [
      ...catalogEntries,
      ...ALL_SEARCH_ENTRIES.filter((entry) => !catalogSlugs.has(entry.slug)),
    ];
  } catch {
    searchEntries = ALL_SEARCH_ENTRIES;
  }

  return (
    <AppShell>
      <NotFoundContent searchEntries={searchEntries} />
    </AppShell>
  );
}
