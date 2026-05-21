"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HomeNavigationHub from "../components/HomeNavigationHub";
import { supabase } from "../lib/supabaseBrowser";

export const dynamic = "force-dynamic";

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

function HomeDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setSessionVerified(false);
        router.push("/login");
        return;
      }

      setSessionVerified(true);
    };

    verifySession();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!sessionVerified) return;
    const raw = searchParams.get("store");
    if (!raw || !STORES.includes(raw)) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("store", "Hillcrest");
      router.replace(`/?${next.toString()}`);
    }
  }, [router, searchParams, sessionVerified]);

  if (!sessionVerified) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse px-4 py-16 text-center text-sm text-slate-400">
        Checking secure session…
      </div>
    );
  }

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
