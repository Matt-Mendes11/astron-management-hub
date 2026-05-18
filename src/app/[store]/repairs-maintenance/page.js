import { notFound } from "next/navigation";
import LegacyLinkCard from "../../../components/drilldown/LegacyLinkCard";
import StoreDrillHeader from "../../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel, storeQueryFromLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

export default async function StoreRepairsPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);
  const q = storeQueryFromLabel(label);
  const ret = encodeURIComponent(`/${store}/repairs-maintenance`);

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader
        title="Repairs & Maintenance"
        subtitle={label}
        backHref={`/${store}`}
        iconName="wrench"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        <LegacyLinkCard
          title="Repairs & Maintenance Log"
          description="Track and manage all maintenance activities and service records."
          buttonLabel="Open Log"
          href={`/repairs-maintenance?${q}&return=${ret}`}
        />
        <LegacyLinkCard
          title="Preferred Contractors"
          description="Contact information for approved contractors and service providers — link to be configured."
          buttonLabel="View Contractors"
          href=""
          disabled
        />
      </div>
    </div>
  );
}
