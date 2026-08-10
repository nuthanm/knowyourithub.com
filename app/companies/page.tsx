import { AppShell } from "@/components/AppShell";
import { CompanyDirectory } from "@/features/companies/company-directory";

export const metadata = {
  title: "Companies — Know Your IT Hub",
  description:
    "Browse verified product-based and service-based companies. Filter by location, type, and industry.",
};

export default function CompaniesPage() {
  return (
    <AppShell active="companies" wide>
      <div className="companies-page-header">
        <h1 className="page-title">Companies</h1>
        <p className="page-lead">
          Verified profiles only — sorted A–Z. Filter by location, type, or industry, and switch list/tile
          view.
        </p>
      </div>
      <CompanyDirectory />
    </AppShell>
  );
}
