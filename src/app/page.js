"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HomeNavigationHub from "../components/HomeNavigationHub";

export const dynamic = "force-dynamic";

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

function HomeDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("store");
    if (!raw || !STORES.includes(raw)) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("store", "Hillcrest");
      router.replace(`/?${next.toString()}`);
    }
  }, [router, searchParams]);

  return <HomeNavigationHub />;
}

export default function HomeDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl animate-pulse px-4 py-16 text-center text-sm text-slate-400">
          Loading hub…
        </div>
      }
    >
      <HomeDashboardInner />
    </Suspense>
  );
}
