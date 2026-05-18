import { notFound } from "next/navigation";
import LegacyLinkCard from "../../../components/drilldown/LegacyLinkCard";
import StoreDrillHeader from "../../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel, storeQueryFromLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

export default async function StoreTeamPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);
  const q = storeQueryFromLabel(label);
  const ret = encodeURIComponent(`/${store}/the-team`);

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader title="Team Management" subtitle={label} backHref={`/${store}`} iconName="users" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        <LegacyLinkCard
          title="Team Documents"
          description="Access team-related documents and personnel files."
          buttonLabel="Open Documents"
          href=""
          disabled
        />
        <LegacyLinkCard
          title="Team Register"
          description="Staff information and contact details registry."
          buttonLabel="View Register"
          href={`/staff-management?${q}&return=${ret}`}
        />
      </div>
    </div>
  );
}
