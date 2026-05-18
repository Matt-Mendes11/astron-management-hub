import { notFound } from "next/navigation";
import { isValidStoreSlug } from "../../lib/stores";

export const dynamic = "force-dynamic";

export default async function StoreSegmentLayout({ children, params }) {
  const { store } = await params;
  if (!isValidStoreSlug(store)) notFound();
  return children;
}
