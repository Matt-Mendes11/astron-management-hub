"use client";

import Link from "next/link";
import {
  Calculator,
  ClipboardCheck,
  Cog,
  Fuel,
  Store,
  Users,
  Wrench,
} from "lucide-react";

const HEADER_ICONS = {
  store: Store,
  wrench: Wrench,
  users: Users,
  fuel: Fuel,
  calculator: Calculator,
  "clipboard-check": ClipboardCheck,
  cog: Cog,
};

/**
 * Calm content header: single title line (Title | context), ← Back aligned on same row.
 */
export default function StoreDrillHeader({ title, subtitle, backHref, iconName }) {
  const Icon = iconName && HEADER_ICONS[iconName] ? HEADER_ICONS[iconName] : null;

  return (
    <div className="mb-8 flex items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {Icon ? (
          <span className="shrink-0 text-[#f97316]" aria-hidden>
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} />
          </span>
        ) : null}
        <h1 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
          <span>{title}</span>
          {subtitle ? (
            <>
              <span className="font-normal text-slate-300"> | </span>
              <span className="font-medium text-slate-600">{subtitle}</span>
            </>
          ) : null}
        </h1>
      </div>
      <Link
        href={backHref}
        className="inline-flex shrink-0 items-center rounded-lg border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90"
      >
        ← Back
      </Link>
    </div>
  );
}
