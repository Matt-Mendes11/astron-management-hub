import { notFound } from "next/navigation";
import LegacyLinkCard from "../../../components/drilldown/LegacyLinkCard";
import StoreDrillHeader from "../../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel, storeQueryFromLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

const ASTRON_HUB_FUEL = "https://connect.astronenergy.co.za/astronb2b/en/ZAR/login";
const WET_STOCKS_LIVE = "https://www.caltex.wsmlive.co.za/system/security/signin.php";

export default async function StoreFuelManagementPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);
  const q = storeQueryFromLabel(label);
  const ret = encodeURIComponent(`/${store}/fuel-management`);
  const fuelPlannerHref = `/fuel-planner?${q}&return=${ret}`;

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader title="Fuel Management" subtitle={label} backHref={`/${store}`} iconName="fuel" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        <LegacyLinkCard
          title="Fuel Plan"
          description="View and manage fuel planning documents and forecasts."
          buttonLabel="Open Fuel Plan"
          href={fuelPlannerHref}
        />
        <LegacyLinkCard
          title="Wet Stocks"
          description="Daily fuel inventory tracking and reconciliation."
          buttonLabel="Open Wet Stocks"
          href=""
          disabled
        />
        <LegacyLinkCard
          title="Pumps & Namos"
          description="Pump management and monitoring systems."
          buttonLabel="Open Pumps & Namos"
          href=""
          disabled
        />
        <LegacyLinkCard
          title="Wet Stocks Live"
          description="Live fuel inventory management system."
          buttonLabel="Open Live"
          href={WET_STOCKS_LIVE}
          external
        />
        <LegacyLinkCard
          title="Astron Fuel Orders"
          description="Fuel ordering and procurement — Astron Hub (Fuel)."
          buttonLabel="Open Orders"
          href={ASTRON_HUB_FUEL}
          external
        />
      </div>
    </div>
  );
}
