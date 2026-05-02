"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

const read = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] != null) return row[key];
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-ZA");
};

function initialsFromName(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarGradient(name) {
  let h = 0;
  const s = name || "x";
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  const hue2 = (hue + 48) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 42%, 38%), hsl(${hue2}, 48%, 32%))`,
  };
}

export default function StaffProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id;
  const printRef = useRef(null);

  const storeParam = searchParams.get("store");
  const selectedStore = STORES.includes(storeParam) ? storeParam : "Hillcrest";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);

  const queryStore = `store=${encodeURIComponent(selectedStore)}`;

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");

    const { data: person, error: pErr } = await supabase
      .from("staff_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (pErr) {
      setError(pErr.message);
      setProfile(null);
      setAssessments([]);
      setLoading(false);
      return;
    }

    if (!person) {
      setError("Staff profile not found.");
      setProfile(null);
      setAssessments([]);
      setLoading(false);
      return;
    }

    if (person.store_name !== selectedStore) {
      setError("This profile belongs to another store. Switch store in the header to view it.");
      setProfile(null);
      setAssessments([]);
      setLoading(false);
      return;
    }

    setProfile(person);

    const { data: assessRows, error: aErr } = await supabase
      .from("site_assessments")
      .select("*")
      .eq("staff_id", id)
      .order("created_at", { ascending: false });

    if (aErr) {
      console.error("Staff profile assessments load:", aErr);
      setAssessments([]);
    } else {
      setAssessments(assessRows || []);
    }

    setLoading(false);
  }, [id, selectedStore]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handlePrint = () => {
    window.print();
  };

  if (!id) {
    return <div className="p-6 text-slate-600">Invalid profile.</div>;
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body aside,
  body header {
    display: none !important;
  }
  body main {
    padding: 10mm 12mm !important;
  }
  .no-print {
    display: none !important;
  }
}
`,
        }}
      />

      <div className="space-y-6">
        {/* Prominent back navigation */}
        <div className="no-print flex flex-wrap items-center gap-3">
          <Link
            href={`/staff-management?${queryStore}`}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-md shadow-slate-200/80 ring-1 ring-slate-100 transition hover:border-[#311162]/25 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            Back to directory
          </Link>
          {profile ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" strokeWidth={2} />
              Print employee record
            </button>
          ) : null}
        </div>

        {error && !profile ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Loading employee file…
          </div>
        ) : profile ? (
          <div ref={printRef} id="employee-record-print" className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
              <div className="grid gap-0 lg:grid-cols-12">
                {/* Left: employee file card */}
                <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white p-8 lg:col-span-5 lg:border-b-0 lg:border-r lg:border-slate-200">
                  <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                    <div
                      className="flex h-28 w-28 items-center justify-center rounded-full text-2xl font-bold text-white shadow-inner ring-4 ring-white"
                      style={avatarGradient(profile.full_name)}
                    >
                      {initialsFromName(profile.full_name)}
                    </div>
                    <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">{profile.full_name}</h1>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                      <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                        {profile.position || "Role not set"}
                      </span>
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        Active
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-500">{selectedStore}</p>
                  </div>

                  <dl className="mt-10 space-y-5 border-t border-slate-200/80 pt-8">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Employee ID</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">{profile.employee_id || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Contact</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">{profile.contact_number || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Joined</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">{formatDate(profile.joined_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Record created</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">{formatDate(profile.created_at)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Right: performance */}
                <div className="p-6 lg:col-span-7 lg:p-8">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Recent performance</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Site assessments linked to this employee ({assessments.length} record
                        {assessments.length === 1 ? "" : "s"})
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    {assessments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">
                        No assessments on file yet. Link assessments from Site Assessments using{" "}
                        <span className="font-semibold text-slate-700">Staff profile</span> when submitting.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            <th className="pb-3 pr-4">Date</th>
                            <th className="pb-3 pr-4">Type</th>
                            <th className="pb-3 pr-4">Assessor</th>
                            <th className="pb-3 pr-4">Score</th>
                            <th className="pb-3">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assessments.map((row) => {
                            const score = Number(read(row, ["score"], 0));
                            const isPass = score >= 80;
                            return (
                              <tr key={row.id} className="text-slate-800">
                                <td className="py-3 pr-4 text-slate-600">
                                  {new Date(read(row, ["created_at"], "")).toLocaleDateString("en-ZA")}
                                </td>
                                <td className="py-3 pr-4 font-medium">{read(row, ["assessment_type"], "—")}</td>
                                <td className="py-3 pr-4 text-slate-600">
                                  {read(row, ["assessor_name", "assessor"], "—")}
                                </td>
                                <td className="py-3 pr-4 font-bold tabular-nums text-slate-900">{score}%</td>
                                <td className="py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                      isPass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {isPass ? "Pass" : "Fail"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Print-only footer line */}
            <p className="hidden print:block text-center text-[10px] text-slate-500">
              Astron Energy — Confidential employee record · Generated {new Date().toLocaleString("en-ZA")}
            </p>
          </div>
        ) : (
          !error && <div className="text-slate-600">Unable to load profile.</div>
        )}
      </div>
    </>
  );
}
