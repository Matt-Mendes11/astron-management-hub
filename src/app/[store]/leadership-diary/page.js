"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import AppDrillBack from "../../../components/drilldown/AppDrillBack";
import LeadershipDiary from "../../../components/LeadershipDiary";
import { isValidStoreSlug, slugToLabel } from "../../../lib/stores";

export const dynamic = "force-dynamic";

function LeadershipDiaryPageInner() {
  const params = useParams();
  const storeSlug = String(params?.store || "");
  const storeName = isValidStoreSlug(storeSlug) ? slugToLabel(storeSlug) : "Hillcrest";

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={isValidStoreSlug(storeSlug) ? `/${storeSlug}` : "/"} />
      <LeadershipDiary storeName={storeName} storeSlug={storeSlug} />
    </div>
  );
}

export default function LeadershipDiaryPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-400">
          Loading leadership diary...
        </div>
      }
    >
      <LeadershipDiaryPageInner />
    </Suspense>
  );
}
