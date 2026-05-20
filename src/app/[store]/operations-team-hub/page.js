"use client";

import { useParams } from "next/navigation";
import AppDrillBack from "../../../components/drilldown/AppDrillBack";
import OperationsTeamHub from "../../../components/OperationsTeamHub";
import { isValidStoreSlug, slugToLabel } from "../../../lib/stores";

export default function OperationsTeamHubPage() {
  const params = useParams();
  const storeSlug = String(params?.store || "");
  const storeName = isValidStoreSlug(storeSlug) ? slugToLabel(storeSlug) : "Hillcrest";

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={isValidStoreSlug(storeSlug) ? `/${storeSlug}` : "/"} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Operations Team Hub</h2>
        <p className="mt-1 text-sm text-slate-600">
          Post and manage branch announcements, checklist document history, and assessment history. For daily shift notes, use{" "}
          <a href={isValidStoreSlug(storeSlug) ? `/${storeSlug}/leadership-diary` : "/"} className="font-semibold text-[#311162] hover:underline">
            Leadership Diary
          </a>
          .
        </p>
      </section>
      <OperationsTeamHub storeName={storeName} storeSlug={storeSlug} />
    </div>
  );
}
