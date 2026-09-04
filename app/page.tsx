import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/features/home/home-page";
import { getCatalogCompanies, getCatalogMetadata } from "@/lib/catalog-db";
import { getQueueSubmissionCounts } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [companies, metadata, queueCounts] = await Promise.all([
    getCatalogCompanies(),
    getCatalogMetadata(),
    getQueueSubmissionCounts(),
  ]);

  return (
    <AppShell active="home" wide>
      <HomePage companies={companies} metadata={metadata} queueCounts={queueCounts} />
    </AppShell>
  );
}
