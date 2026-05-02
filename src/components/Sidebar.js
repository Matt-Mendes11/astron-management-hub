"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ClipboardCheck,
  CreditCard,
  Fuel,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "Fuel Planner", href: "/fuel-planner", icon: Fuel },
  { label: "Operations Hub", href: "/operations-team-hub", icon: ShieldCheck },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Site Assessments", href: "/site-assessments", icon: ClipboardCheck },
  { label: "Repairs & Maintenance", href: "/repairs-maintenance", icon: Wrench },
  { label: "Staff Management", href: "/staff-management", icon: Users },
];

const isItemActive = (pathname, href) => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-[#311162] via-[#4a1a94] to-[#2a0f55] text-white shadow-xl backdrop-blur-md transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className={`border-b border-white/10 ${collapsed ? "px-3 py-6" : "px-6 py-10"}`}>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute right-3 top-3 rounded-lg bg-white/10 p-1.5 text-white/85 transition hover:bg-white/20 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff6a00] text-2xl font-black text-white shadow-sm">
            A
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <p className="text-2xl font-extrabold tracking-widest text-white">ASTRON</p>
              <p className="text-[11px] font-semibold tracking-widest text-white/85">ENERGY</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className={`flex-1 ${collapsed ? "px-2 py-5" : "px-3 py-6"}`}>
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="group relative">
                {active ? (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#ff6a00]" />
                ) : null}
                <Link
                  href={item.href}
                  title={collapsed ? item.label : ""}
                  className={`flex items-center rounded-xl transition ${
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
                  } ${
                    active
                      ? "bg-white/5 text-white"
                      : "bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center">
                    <Icon size={20} strokeWidth={1.9} />
                  </span>
                  {!collapsed ? (
                    <span className="text-[13px] font-medium tracking-wide">{item.label}</span>
                  ) : null}
                </Link>
                {collapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#231042]/95 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                    {item.label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-white/10 p-3">
        <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#ff6a00] text-xs font-bold text-white">
              M
            </div>
            {!collapsed ? (
              <div>
                <p className="text-sm font-semibold text-white">M. Mendes</p>
                <p className="text-xs text-white/70">Regional Manager</p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              title="Sign Out"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white/90 transition hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
