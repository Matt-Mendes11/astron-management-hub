"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  Home,
  LogOut,
  Menu,
  ShieldCheck,
  Store,
} from "lucide-react";
import { isManagerProfile, signOut, useAuthProfile } from "../lib/authProfile";
import { STORE_CONFIG, isValidStoreSlug, labelToSlug, slugToLabel } from "../lib/stores";

const iconStrokeWidth = 1.6;

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuthProfile();

  if (pathname === "/login") return null;

  const pathSlugMatch = pathname.match(/^\/(hillcrest|hammersdale|gillitts|cato-ridge)(?:\/|$)/);
  const pathSlug = pathSlugMatch?.[1];
  const permittedStores = isManagerProfile(profile)
    ? STORE_CONFIG
    : STORE_CONFIG.filter((store) => store.label === (profile?.storeName || "Hillcrest"));
  const activeStoreLabel =
    pathSlug && isValidStoreSlug(pathSlug)
      ? slugToLabel(pathSlug)
      : searchParams.get("store") && STORE_CONFIG.some((s) => s.label === searchParams.get("store"))
        ? searchParams.get("store")
        : "Hillcrest";
  const isHillcrest = activeStoreLabel === "Hillcrest";

  const segments = pathname.split("/").filter(Boolean);
  const routeRoot = segments[0] || "";

  const homeActive = pathname === "/";
  const storeLinkActive = (slug) => routeRoot === slug;
  const activeStoreSlug = labelToSlug(activeStoreLabel);
  const opsActive =
    pathname === `/${activeStoreSlug}/operations-team-hub` ||
    pathname.startsWith(`/${activeStoreSlug}/operations-team-hub/`);
  const diaryActive =
    pathname === `/${activeStoreSlug}/leadership-diary` ||
    pathname.startsWith(`/${activeStoreSlug}/leadership-diary/`);

  const opsHref = `/${activeStoreSlug}/operations-team-hub`;
  const diaryHref = `/${activeStoreSlug}/leadership-diary`;

  const navClass = (active) =>
    `flex items-center rounded-xl transition ${
      collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
    } ${
      active
        ? "bg-white/12 text-white shadow-sm ring-1 ring-white/15 ring-inset"
        : "bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
    }`;

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
          {collapsed ? (
            <Menu className="h-4 w-4" strokeWidth={iconStrokeWidth} />
          ) : (
            <ChevronLeft className="h-4 w-4" strokeWidth={iconStrokeWidth} />
          )}
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

      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-5" : "px-3 py-6"}`}>
        <p
          className={`${collapsed ? "px-0 text-center" : "px-4"} pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35`}
        >
          {!collapsed ? "Main" : "—"}
        </p>
        <ul className="space-y-1">
          <li className="group relative">
            {homeActive ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#ff6a00]" /> : null}
            <Link href="/" title={collapsed ? "Home" : ""} className={navClass(homeActive)} aria-current={homeActive ? "page" : undefined}>
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <Home size={22} strokeWidth={iconStrokeWidth} />
              </span>
              {!collapsed ? <span className="text-[13px] font-medium tracking-wide">Home</span> : null}
            </Link>
            {collapsed ? (
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#231042]/95 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                Home
              </span>
            ) : null}
          </li>
        </ul>

        <p
          className={`${collapsed ? "mt-4 px-0 text-center" : "mt-6 px-4"} pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35`}
        >
          {!collapsed ? "Stores" : "—"}
        </p>
        <ul className="space-y-1">
          {permittedStores.map(({ slug, label }) => {
            const active = storeLinkActive(slug);
            return (
              <li key={slug} className="group relative">
                {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#ff6a00]" /> : null}
                <Link
                  href={`/${slug}`}
                  title={`${label} — branch home`}
                  className={navClass(active)}
                  aria-current={active ? "true" : undefined}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center">
                    <Store size={22} strokeWidth={iconStrokeWidth} />
                  </span>
                  {!collapsed ? <span className="text-[13px] font-medium tracking-wide">{label}</span> : null}
                </Link>
                {collapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#231042]/95 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                    {label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p
          className={`${collapsed ? "mt-4 px-0 text-center" : "mt-6 px-4"} pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35`}
        >
          {!collapsed ? "Management" : "—"}
        </p>
        <ul className="space-y-1">
          <li className="group relative">
            {opsActive ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#ff6a00]" /> : null}
            <Link
              href={opsHref}
              title={collapsed ? "Operations Team Hub" : ""}
              className={navClass(opsActive)}
              aria-current={opsActive ? "page" : undefined}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <ShieldCheck size={22} strokeWidth={iconStrokeWidth} />
              </span>
              {!collapsed ? (
                <span className="text-[13px] font-medium tracking-wide">Operations Team Hub</span>
              ) : null}
            </Link>
            {collapsed ? (
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#231042]/95 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                Operations Team Hub
              </span>
            ) : null}
          </li>
          <li className="group relative">
            {diaryActive ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#ff6a00]" /> : null}
            <Link
              href={diaryHref}
              title={collapsed ? "Leadership Diary" : ""}
              className={navClass(diaryActive)}
              aria-current={diaryActive ? "page" : undefined}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <BookOpen size={22} strokeWidth={iconStrokeWidth} />
              </span>
              {!collapsed ? <span className="text-[13px] font-medium tracking-wide">Leadership Diary</span> : null}
            </Link>
            {collapsed ? (
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#231042]/95 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                Leadership Diary
              </span>
            ) : null}
          </li>
        </ul>
      </nav>

      {collapsed ? (
        <div className="px-2 pb-3" title={`Active site: ${activeStoreLabel}`}>
          <div
            className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl border ${
              isHillcrest ? "border-[#ff6a00]/50 bg-[#ff6a00]/15 text-[#ff6a00]" : "border-white/15 bg-white/5 text-white/80"
            }`}
          >
            <Store className="h-5 w-5" strokeWidth={iconStrokeWidth} aria-hidden />
          </div>
        </div>
      ) : (
        <div className="px-3 pb-4">
          <div
            className={`rounded-xl border px-3 py-3 ${
              isHillcrest ? "border-[#ff6a00]/40 bg-[#ff6a00]/10" : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Active site</p>
            <p
              className={`mt-1 flex items-center gap-2 text-sm font-semibold ${
                isHillcrest ? "text-[#ffb86c]" : "text-white"
              }`}
            >
              <Store className="h-4 w-4 shrink-0 text-[#ff6a00]" strokeWidth={iconStrokeWidth} aria-hidden />
              {activeStoreLabel}
            </p>
            {isHillcrest ? (
              <p className="mt-2 text-[11px] leading-snug text-white/70">
                Hillcrest is the default hub site. Managers can switch branch context.
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-white/60">
                Branch access follows your assigned profile store.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-white/10 p-3">
        <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#ff6a00] text-xs font-bold uppercase text-white">
              {(profile?.fullName || profile?.email || "U").slice(0, 1)}
            </div>
            {!collapsed ? (
              <div>
                <p className="text-sm font-semibold text-white">{profile?.fullName || "Signed in user"}</p>
                <p className="text-xs capitalize text-white/70">{profile?.role || "staff"}</p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              onClick={signOut}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={iconStrokeWidth} />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              title="Sign Out"
              onClick={signOut}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-white/90 transition hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={iconStrokeWidth} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="relative flex w-64 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-[#311162] via-[#4a1a94] to-[#2a0f55]" />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}
