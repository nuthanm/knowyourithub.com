import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-meta";
import { getCatalogCompanies, getCatalogMetadata } from "@/lib/catalog-db";

export const dynamic = "force-dynamic";

const STATIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/companies", changeFrequency: "daily", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/coming-soon", changeFrequency: "weekly", priority: 0.5 },
  { path: "/submit", changeFrequency: "monthly", priority: 0.6 },
  { path: "/feedback", changeFrequency: "monthly", priority: 0.5 },
  { path: "/brief", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms-and-conditions", changeFrequency: "yearly", priority: 0.3 },
];

function toUrl(base: string, path: string) {
  const normalized = path === "" ? "/" : path;
  return `${base}${normalized === "/" ? "/" : normalized}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl("https://knowyourithub.com");
  const [companies, metadata] = await Promise.all([getCatalogCompanies(), getCatalogMetadata()]);
  const catalogDate = new Date(metadata.catalogUpdated);

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: toUrl(base, path),
    lastModified: catalogDate,
    changeFrequency,
    priority,
  }));

  const companyEntries: MetadataRoute.Sitemap = companies.filter(
    (company) => company.verificationStatus === "verified",
  ).map((company) => ({
    url: toUrl(base, `/companies/${company.slug}`),
    lastModified: company.lastVerified ? new Date(company.lastVerified) : catalogDate,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...companyEntries];
}
