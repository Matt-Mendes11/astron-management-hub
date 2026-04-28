"use client";

import OperationsTeamHub from "../../components/OperationsTeamHub";

export default function OperationsTeamHubPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Operations Team Hub</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manager control center for posting, tracking, and removing branch notices.
        </p>
      </section>
      <OperationsTeamHub />
    </div>
  );
}
