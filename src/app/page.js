"use client";

import NoticeBoard from "../components/NoticeBoard";

export default function HomeDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Home Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Operations command center for branch notices and team directives.
        </p>
      </section>
      <NoticeBoard />
    </div>
  );
}
