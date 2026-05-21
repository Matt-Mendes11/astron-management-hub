import { notFound } from "next/navigation";
import StoreDrillHeader from "../../components/drilldown/StoreDrillHeader";
import StoreOperationsTiles from "../../components/drilldown/StoreOperationsTiles";
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

      <StoreOperationsTiles store={store} />
    </div>
  );
}
