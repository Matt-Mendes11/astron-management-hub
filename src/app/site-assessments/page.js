"use client";

import { useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Shield } from "lucide-react";
import AppDrillBack from "../../components/drilldown/AppDrillBack";
import DailyChecklistAudit from "../../components/audits/DailyChecklistAudit";
import SiteAssessmentsPanel from "../../components/audits/SiteAssessmentsPanel";
import { labelToSlug } from "../../lib/stores";

export const dynamic = "force-dynamic";

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

export default function SiteAssessmentsPage() {
  const searchParams = useSearchParams();
  const selectedStore = STORES.includes(searchParams.get("store")) ? searchParams.get("store") : "Hillcrest";

  const backHref = useMemo(() => {
    const r = searchParams.get("return");
    if (r) {
      try {
        return decodeURIComponent(r);
      } catch {
        return r;
      }
    }
    return `/${labelToSlug(selectedStore)}/routines-and-audits`;
  }, [searchParams, selectedStore]);

  return (
    <div className="space-y-8">
      <AppDrillBack backHref={backHref} />

      <header className="flex flex-wrap items-baseline gap-3 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Site Audits &amp; Daily Checklists
        </h1>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {selectedStore}
        </span>
      </header>

      <Tabs.Root defaultValue="daily" className="space-y-6">
        <Tabs.List className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <Tabs.Trigger
            value="daily"
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-[#ff6a00] data-[state=active]:text-white"
          >
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
              Daily checklist
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="assessments"
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-[#ff6a00] data-[state=active]:text-white"
          >
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4" strokeWidth={2} />
              Assessments
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="daily">
          <DailyChecklistAudit storeName={selectedStore} />
        </Tabs.Content>

        <Tabs.Content value="assessments">
          <SiteAssessmentsPanel storeName={selectedStore} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
