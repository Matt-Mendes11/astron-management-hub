"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  Cog,
  Fuel,
  Users,
  Wrench,
} from "lucide-react";

const TILE_ICONS = {
  "clipboard-check": ClipboardCheck,
  wrench: Wrench,
  users: Users,
  fuel: Fuel,
  cog: Cog,
};

export default function OpsTile({ href, iconName, title, description }) {
  const Icon = TILE_ICONS[iconName] || ClipboardCheck;

  return (
    <Link
      href={href}
      className="flex flex-col items-center rounded-[10px] border border-slate-200 bg-white px-5 py-6 text-center shadow-sm transition hover:border-[#f97316] hover:shadow-md"
    >
      <span className="mb-3 text-[#f97316]" aria-hidden>
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <h2 className="text-[0.875rem] font-semibold leading-snug text-slate-900">{title}</h2>
      <p className="mt-2 text-[0.75rem] leading-snug text-slate-600">{description}</p>
    </Link>
  );
}
