"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppDrillBack from "../../../components/drilldown/AppDrillBack";
import StaffDocumentVault from "../../../components/staff/StaffDocumentVault";
import StaffProfileFormFields from "../../../components/staff/StaffProfileFormFields";
import { deleteStaffMember, formToStaffPayload, profileToForm, trainingStatusStyles } from "../../../lib/staff";
import { Pencil, Printer, Trash2 } from "lucide-react";

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

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function StaffProfilePage() {
  const router = useRouter();
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
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => profileToForm(null));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const queryStore = `store=${encodeURIComponent(selectedStore)}`;

  const backHref = useMemo(() => {
    const r = searchParams.get("return");
    if (r) {
      try {
        return decodeURIComponent(r);
      } catch {
        return r;
      }
    }
    return `/staff-management?${queryStore}`;
  }, [searchParams, queryStore]);

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
    setEditForm(profileToForm(person));

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

  const openEdit = () => {
    setEditForm(profileToForm(profile));
    setEditOpen(true);
  };

  const saveProfile = async () => {
    const name = editForm.full_name.trim();
    if (!name) {
      alert("Full name is required.");
      return;
    }
    setSaving(true);
    const payload = formToStaffPayload(editForm, selectedStore);
    payload.full_name = name;

    const { error: upErr } = await supabase.from("staff_profiles").update(payload).eq("id", id);
    setSaving(false);
    if (upErr) {
      alert(upErr.message || "Could not update profile.");
      return;
    }
    setEditOpen(false);
    await loadProfile();
  };

  const handlePrint = () => {
    window.print();
  };

  const removeProfile = async () => {
    if (!profile) return;
    const name = profile.full_name || "this team member";
    if (
      !window.confirm(
        `Delete ${name} from ${selectedStore}? Their profile and uploaded documents will be removed. Past assessments will stay but will no longer be linked to this profile.`
      )
    ) {
      return;
    }
    setDeleting(true);
    const result = await deleteStaffMember(supabase, { staffId: id, storeName: selectedStore });
    setDeleting(false);
    if (!result.ok) {
      alert(result.error || "Could not delete staff member.");
      return;
    }
    router.push(backHref);
  };

  if (!id) {
    return <div className="p-6 text-slate-600">Invalid profile.</div>;
  }

  const trainingStatus = profile?.training_status || "Pending";

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
        <AppDrillBack backHref={backHref} />
        <div className="no-print flex flex-wrap items-center justify-end gap-3">
          {profile ? (
            <>
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-[#311162]/25 bg-[#311162]/5 px-4 py-3 text-sm font-semibold text-[#311162] shadow-sm transition hover:bg-[#311162]/10"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
                Edit profile
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" strokeWidth={2} />
                Print employee record
              </button>
              <button
                type="button"
                onClick={removeProfile}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                {deleting ? "Deleting…" : "Delete profile"}
              </button>
            </>
          ) : null}
        </div>

        {error && !profile ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Loading employee file…
          </div>
        ) : profile ? (
          <div ref={printRef} id="employee-record-print" className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100">
              <div className="grid gap-0 lg:grid-cols-2">
                {/* Left column */}
                <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white p-6 lg:border-b-0 lg:border-r lg:p-8">
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

                  <section className="mt-10 border-t border-slate-200/80 pt-8">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">
                      Personal details
                    </h2>
                    <dl className="mt-5 space-y-5">
                      <DetailRow label="Employee ID" value={profile.employee_id} />
                      <DetailRow label="ID number" value={profile.id_number} />
                      <DetailRow label="Date of birth" value={formatDate(profile.date_of_birth)} />
                      <DetailRow label="Contact" value={profile.contact_number} />
                      <DetailRow label="Home address" value={profile.home_address} />
                      <DetailRow label="Joined" value={formatDate(profile.joined_date)} />
                      <DetailRow label="Record created" value={formatDate(profile.created_at)} />
                    </dl>
                  </section>

                  <section className="mt-10 border-t border-slate-200/80 pt-8">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">
                      Emergency contact
                    </h2>
                    <dl className="mt-5 space-y-5">
                      <DetailRow label="Name" value={profile.emergency_contact_name} />
                      <DetailRow label="Phone" value={profile.emergency_contact_phone} />
                    </dl>
                  </section>
                </div>

                {/* Right column */}
                <div className="space-y-8 p-6 lg:p-8">
                  <section>
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">
                      Training status
                    </h2>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ring-1 ${trainingStatusStyles(
                          trainingStatus
                        )}`}
                      >
                        {trainingStatus}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">
                        Update via Edit profile when certification progress changes.
                      </p>
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Performance history</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Site assessments ({assessments.length} record{assessments.length === 1 ? "" : "s"})
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
                  </section>

                  <StaffDocumentVault supabase={supabase} staffId={id} storeName={selectedStore} />
                </div>
              </div>
            </div>

            <p className="hidden print:block text-center text-[10px] text-slate-500">
              Astron Energy — Confidential employee record · Generated {new Date().toLocaleString("en-ZA")}
            </p>
          </div>
        ) : (
          !error && <div className="text-slate-600">Unable to load profile.</div>
        )}
      </div>

      {editOpen ? (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div
            className="flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-title"
          >
            <div className="shrink-0 border-b border-slate-100 px-6 py-5">
              <h3 id="edit-staff-title" className="text-lg font-bold text-slate-900">
                Edit profile
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {profile.full_name} · <strong className="text-slate-700">{selectedStore}</strong>
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <StaffProfileFormFields form={editForm} setForm={setEditForm} />
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-[#ff6a00] to-[#ff8533] px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
