import { notFound } from "next/navigation";
import LegacyLinkCard from "../../../components/drilldown/LegacyLinkCard";
import StoreDrillHeader from "../../../components/drilldown/StoreDrillHeader";
import { isValidStoreSlug, slugToLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

export default async function StoreRoutinesPage({ params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  const label = slugToLabel(store);
  const ret = encodeURIComponent(`/${store}/routines-and-audits`);

  return (
    <div className="mx-auto max-w-5xl">
      <StoreDrillHeader title="Routines & Audits" subtitle={label} backHref={`/${store}`} iconName="clipboard-check" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        <LegacyLinkCard
          title="Site assessments & checklists"
          buttonLabel="Open assessments"
          href={`/${store}/routines-and-audits/site-assessments?return=${ret}`}
        />
        <LegacyLinkCard
          title="Daily store checksheet"
          description="Daily operational audits — link to be configured."
          buttonLabel="Open checksheet"
          href=""
          disabled
        />
      </div>
    </div>
  );
}
