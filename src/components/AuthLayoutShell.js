"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppHeader from "./AppHeader";
import Sidebar from "./Sidebar";
import { supabase } from "../lib/supabaseBrowser";

export default function AuthLayoutShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [authState, setAuthState] = useState(isLoginPage ? "public" : "checking");

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      if (isLoginPage) {
        setAuthState("public");
        return;
      }

      setAuthState("checking");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setAuthState("guest");
        router.replace("/login");
        return;
      }

      setAuthState("authenticated");
    };

    verifySession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isLoginPage) {
        setAuthState("public");
        return;
      }

      if (!session) {
        setAuthState("guest");
        router.replace("/login");
        return;
      }

      setAuthState("authenticated");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <main className="min-h-screen p-6 lg:p-8">{children}</main>;
  }

  if (authState !== "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-500 shadow-sm">
          Checking secure session...
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
