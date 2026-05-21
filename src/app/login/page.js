"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowser";
import { STORE_CONFIG } from "../../lib/stores";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupForm, setSetupForm] = useState({
    email: "",
    password: "",
    fullName: "",
    assignedStore: "Hillcrest",
    setupCode: "",
  });
  const [setupError, setSetupError] = useState("");
  const [setupNotice, setSetupNotice] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (loginError) {
      setError(loginError.message || "Could not sign in.");
      return;
    }

    router.replace(nextPath.startsWith("/") ? nextPath : "/");
    router.refresh();
  };

  const updateSetup = (field, value) => {
    setSetupForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitBootstrapManager = async (event) => {
    event.preventDefault();
    setSetupError("");
    setSetupNotice("");
    setSetupLoading(true);

    const response = await fetch("/api/auth/bootstrap-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setupForm),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSetupLoading(false);
      setSetupError(payload.error || "Could not create manager login.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: setupForm.email.trim(),
      password: setupForm.password,
    });

    setSetupLoading(false);
    if (loginError) {
      setSetupNotice(
        "Manager account is ready. Sign in with the email and password you just set — no confirmation email is required."
      );
      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <div className="-m-6 min-h-screen bg-white lg:-m-8">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#170826] text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,110,0,0.38),transparent_28%),radial-gradient(circle_at_74%_24%,rgba(141,84,255,0.34),transparent_32%),linear-gradient(135deg,#12051f_0%,#311162_48%,#090313_100%)]" />
          <div className="absolute inset-0 bg-[url('https://source.unsplash.com/QfevVNnoHkg/1600x1200')] bg-cover bg-center opacity-10 mix-blend-screen" />
          <div className="absolute inset-0 opacity-[0.055] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
          <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[#ff6e00]/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between p-14">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white ring-1 ring-white/15 backdrop-blur">
                A
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-[0.22em]">ASTRON</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                  Energy Portal
                </p>
              </div>
            </div>

            <div className="max-w-xl pb-8">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-orange-200">
                Enterprise branch operations
              </p>
              <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight xl:text-6xl">
                Astron Operations Hub.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-white/68">
                Secure access for managers, store teams, and operational controls across every branch.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#ff6e00]">Portal Login</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in with your Astron Operations Hub credentials.
              </p>
            </div>

            <form onSubmit={submitLogin} className="mt-10 space-y-6">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                placeholder="name@astron.example"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                placeholder="Password"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#ff6e00] px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:shadow-orange-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => setSetupOpen((value) => !value)}
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-[#ff6e00]"
            >
              {setupOpen ? "Hide account setup" : "Create manager account"}
            </button>
            {setupOpen ? (
              <form onSubmit={submitBootstrapManager} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs leading-5 text-slate-500">
                  Create or repair a manager login. This requires your private setup code and the server-side Supabase service role key.
                </p>
                <input
                  type="email"
                  value={setupForm.email}
                  onChange={(event) => updateSetup("email", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                  placeholder="Manager email"
                />
                <input
                  type="password"
                  value={setupForm.password}
                  onChange={(event) => updateSetup("password", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                  placeholder="Temporary password"
                />
                <input
                  value={setupForm.fullName}
                  onChange={(event) => updateSetup("fullName", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                  placeholder="Full name"
                />
                <select
                  value={setupForm.assignedStore}
                  onChange={(event) => updateSetup("assignedStore", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                >
                  {STORE_CONFIG.map((store) => (
                    <option key={store.slug} value={store.label}>
                      {store.label}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  value={setupForm.setupCode}
                  onChange={(event) => updateSetup("setupCode", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#ff6e00] focus:shadow-[0_0_0_4px_rgba(255,110,0,0.10)]"
                  placeholder="Manager setup code"
                />
                {setupError ? <p className="text-xs font-semibold text-red-600">{setupError}</p> : null}
                {setupNotice ? <p className="text-xs font-semibold text-emerald-700">{setupNotice}</p> : null}
                <button
                  type="submit"
                  disabled={setupLoading}
                  className="w-full rounded-xl bg-[#311162] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-[#4a1a94] disabled:opacity-60"
                >
                  {setupLoading ? "Creating manager..." : "Create / repair manager account"}
                </button>
              </form>
            ) : null}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
