"use client";

import { useEffect, useState } from "react";

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
  const [dateLine, setDateLine] = useState({ label: "", iso: "" });

  useEffect(() => {
    const d = new Date();
    setDateLine({ label: formatTopDate(d), iso: d.toISOString().slice(0, 10) });
  }, []);

  return (
    <header className="flex h-[3.75rem] shrink-0 items-center border-b border-slate-200/90 bg-white px-6 sm:px-10 lg:px-12">
      <div className="flex w-full min-w-0 items-center justify-between gap-8">
        <h1 className="min-w-0 text-base font-semibold tracking-tight text-slate-800 sm:text-lg">
          Regional Terminal Portal
        </h1>
        <time
          className="shrink-0 tabular-nums text-right text-[13px] font-medium tracking-[0.02em] text-slate-500 sm:text-sm"
          dateTime={dateLine.iso || undefined}
          suppressHydrationWarning
        >
          {dateLine.label || "\u00a0"}
        </time>
      </div>
    </header>
  );
}
