"use client";

import { Suspense } from "react";
import { AlertTriangle, FolderOpen, Phone } from "lucide-react";
import LeadershipDiary from "./LeadershipDiary";
import NoticeBoard from "./NoticeBoard";

function QuickAccessTile({ icon: Icon, title, description }) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
      role="status"
      aria-label={`${title} — coming soon`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[#f97316]"
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={1.85} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function DiaryFeedFallback() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
      Loading leadership diary…
    </div>
  );
}

export default function HomeNavigationHub() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-0 pb-14 sm:px-1">
      <NoticeBoard hubLayout />

      <Suspense fallback={<DiaryFeedFallback />}>
        <LeadershipDiary compact />
      </Suspense>

      <section className="border-t border-slate-200/80 pt-8">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAccessTile
            icon={FolderOpen}
            title="Template Vault"
            description="Templates and forms — link coming soon."
          />
          <QuickAccessTile
            icon={AlertTriangle}
            title="Incident Reporting"
            description="Safety workflows — connection pending."
          />
          <QuickAccessTile
            icon={Phone}
            title="Conference Calls"
            description="Call notes vault — opening soon."
          />
        </div>
      </section>
    </div>
  );
}
