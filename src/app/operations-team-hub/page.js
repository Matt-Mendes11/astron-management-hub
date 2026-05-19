"use client";

import AppDrillBack from "../../components/drilldown/AppDrillBack";
import OperationsTeamHub from "../../components/OperationsTeamHub";

export default function OperationsTeamHubPage() {
  return (
    <div className="space-y-6">
      <AppDrillBack backHref="/" />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Operations Team Hub</h2>
        <p className="mt-1 text-sm text-slate-600">
          Post and manage branch announcements, review assessment history, and run audits. For daily shift notes, use{" "}
          <a href="/leadership-diary" className="font-semibold text-[#311162] hover:underline">
            Leadership Diary
          </a>
          .
        </p>
      </section>
      <OperationsTeamHub />
    </div>
  );
}
