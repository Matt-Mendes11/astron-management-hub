"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { isValidStoreSlug, slugToLabel } from "../lib/stores";

function formatTopDate(d = new Date()) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const w = weekdays[d.getDay()];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const y = d.getFullYear();
  return `${w}, ${day} ${mon} ${y}`;
}

export default function AppHeader() {
  const pathname = usePathname();
  const dateLine = useMemo(() => {
    const d = new Date();
    return { label: formatTopDate(d), iso: d.toISOString().slice(0, 10) };
  }, []);

  if (pathname === "/login") return null;

  const pathSlug = pathname.match(/^\/([^/]+)/)?.[1] || "";
  const storeLabel = isValidStoreSlug(pathSlug) ? slugToLabel(pathSlug) : "All Stores";

  return (
    <header className="flex h-[4rem] shrink-0 items-center border-b border-slate-200/90 bg-white px-6 sm:px-10 lg:px-12">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="min-w-0 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
          Regional Terminal Portal
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <div className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Store</span>
            <span className="text-slate-900">{storeLabel}</span>
          </div>
          <time
            className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold tabular-nums tracking-[0.02em] text-slate-600"
            dateTime={dateLine.iso || undefined}
            suppressHydrationWarning
          >
            {dateLine.label || "\u00a0"}
          </time>
        </div>
      </div>
    </header>
  );
}
