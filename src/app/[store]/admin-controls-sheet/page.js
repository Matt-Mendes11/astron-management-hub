import { notFound } from "next/navigation";
import LegacyLinkCard from "../../../components/drilldown/LegacyLinkCard";
import StoreDrillHeader from "../../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel, storeQueryFromLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

const ADMIN_TILES = [
  { title: "Account Payments", description: "Supplier account payments and allocations.", buttonLabel: "Open Account Payments" },
  { title: "Glocell Invoices", description: "Glocell billing and invoice history.", buttonLabel: "Open Glocell Invoices" },
  { title: "Credits Owing", description: "Credits on account and reconciliation notes.", buttonLabel: "Open Credits Owing" },
  { title: "Supplier Statement", description: "Supplier statement requests and archives.", buttonLabel: "Open Supplier Statement" },
  {
    title: "Payment Plan",
    description: "Payment planning and recurring schedules.",
    buttonLabel: "Open Payment Plan",
    hrefKey: "payments",
  },
  { title: "Deductions", description: "Payroll and supplier deductions tracking.", buttonLabel: "Open Deductions" },
  { title: "Banking Recon", description: "Bank reconciliation worksheets and sign-off.", buttonLabel: "Open Banking Recon" },
];

export default async function StoreAdminControlsPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);
  const q = storeQueryFromLabel(label);
  const ret = encodeURIComponent(`/${store}/admin-controls-sheet`);
  const paymentsHref = `/payments?${q}&return=${ret}`;

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader
        title="Admin Controls Sheet"
        subtitle={label}
        backHref={`/${store}`}
        iconName="calculator"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {ADMIN_TILES.map((t) => (
          <LegacyLinkCard
            key={t.title}
            title={t.title}
            description={t.description}
            buttonLabel={t.buttonLabel}
            href={t.hrefKey === "payments" ? paymentsHref : ""}
            disabled={t.hrefKey !== "payments"}
          />
        ))}
      </div>
    </div>
  );
}
