import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CompanyDetail } from "@/features/company/company-detail";
import { CompanyPipelineDetail } from "@/features/company/company-pipeline-detail";
import { getCompanyEntryBySlug } from "@/lib/companies";
import { getCatalogCompanyBySlug } from "@/lib/catalog-db";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const company = await getCatalogCompanyBySlug(slug);
  const entry = getCompanyEntryBySlug(slug);
  if (!entry && !company) return { title: "Company not found — Know Your IT Hub" };
  return {
    title: `${company?.name ?? entry?.name} — Know Your IT Hub`,
    description: company?.tagline ?? entry?.note ?? `${company?.name ?? entry?.name} on Know Your IT Hub`,
  };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCatalogCompanyBySlug(slug);
  const entry = getCompanyEntryBySlug(slug);
  if (!entry && !company) notFound();

  return (
    <AppShell active="companies" wide>
      {company ? <CompanyDetail company={company} /> : <CompanyPipelineDetail entry={entry!} />}
    </AppShell>
  );
}
