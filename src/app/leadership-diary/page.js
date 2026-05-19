"use client";

import { Suspense } from "react";
import AppDrillBack from "../../components/drilldown/AppDrillBack";
import LeadershipDiary from "../../components/LeadershipDiary";

export const dynamic = "force-dynamic";

function LeadershipDiaryPageInner() {
  return (
    <div className="space-y-6">
      <AppDrillBack backHref="/" />
      <LeadershipDiary />
    </div>
  );
}

export default function LeadershipDiaryPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-400">
          Loading leadership diary…
        </div>
      }
    >
      <LeadershipDiaryPageInner />
    </Suspense>
  );
}
