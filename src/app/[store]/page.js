import { notFound } from "next/navigation";
import OpsTile from "../../components/drilldown/OpsTile";
import StoreDrillHeader from "../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel } from "../../lib/stores";

export const dynamic = "force-dynamic";

export default async function StoreOperationsPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader
        title={`${label} Operations`}
        backHref="/"
        iconName="store"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OpsTile
          href={`/${store}/routines-and-audits`}
          iconName="clipboard-check"
          title="Routines & Audits"
          description="Daily operational audits"
        />
        <OpsTile
          href={`/${store}/repairs-maintenance`}
          iconName="wrench"
          title="Repairs & Maintenance"
          description="Equipment maintenance"
        />
        <OpsTile href={`/${store}/the-team`} iconName="users" title="The Team" description="Staff management" />
        <OpsTile
          href={`/${store}/fuel-management`}
          iconName="fuel"
          title="Fuel Management"
          description="Fuel planning & inventory"
        />
        <OpsTile
          href={`/${store}/admin-controls-sheet`}
          iconName="cog"
          title="Admin Controls Sheet"
          description="Financial controls & payments"
        />
      </div>
    </div>
  );
}
