"use client";

import Link from "next/link";

/** Top-right ← Back for standalone tool routes (payments, fuel planner, etc.). */
export default function AppDrillBack({ backHref }) {
  if (!backHref) return null;
  return (
    <div className="mb-4 flex justify-end">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
      >
        ← Back
      </Link>
    </div>
  );
}
