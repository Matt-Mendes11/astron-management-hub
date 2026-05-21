"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppDrillBack from "../../../../components/drilldown/AppDrillBack";
import StaffDocumentVault from "../../../../components/staff/StaffDocumentVault";
import StaffProfileFormFields from "../../../../components/staff/StaffProfileFormFields";
import { deleteStaffMember, formToStaffPayload, profileToForm, trainingStatusStyles } from "../../../../lib/staff";
import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../../lib/storeRoute";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { useAuthProfile } from "../../../../lib/authProfile";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];
const BRAND_PURPLE = [49, 17, 98];
const BRAND_ORANGE = [255, 110, 0];

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

const safeFilePart = (value) =>
  String(value || "employee-file")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function drawPdfHeader(doc, { storeName, title }) {
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const generated = new Date().toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_PURPLE);
  doc.text(`ASTRON Energy - ${storeName}`, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);
  doc.text(title, margin, 20);
  doc.text(generated, pageWidth - margin, 14, { align: "right" });
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(0.55);
  doc.line(margin, 24, pageWidth - margin, 24);
  doc.setTextColor(15, 23, 42);
}

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

  const storeSlug = storeSlugFromRoute(params?.store, searchParams);
  const selectedStore = storeLabelFromRoute(params?.store, searchParams);
  const { isManager } = useAuthProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [documents, setDocuments] = useState([]);
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
    return backHrefFromReturn(searchParams, `/${storeSlug}/the-team`);
  }, [searchParams, storeSlug]);

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
      setDocuments([]);
      setLoading(false);
      return;
    }

    if (!person) {
      setError("Staff profile not found.");
      setProfile(null);
      setAssessments([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    if (person.store_name !== selectedStore) {
      setError("This profile belongs to another store. Switch store in the header to view it.");
      setProfile(null);
      setAssessments([]);
      setDocuments([]);
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

    const { data: docRows, error: dErr } = await supabase
      .from("staff_documents")
      .select("id, file_name, uploaded_at")
      .eq("staff_id", id)
      .order("uploaded_at", { ascending: false });

    if (dErr) {
      console.error("Staff profile documents load:", dErr);
      setDocuments([]);
    } else {
      setDocuments(docRows || []);
    }

    setLoading(false);
  }, [id, selectedStore]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadProfile();
    }, 0);
    return () => window.clearTimeout(timeoutId);
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

  const handlePrintEmployeeFile = () => {
    if (!profile) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawPdfHeader(doc, { storeName: selectedStore, title: "Confidential employee file" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(profile.full_name || "Employee Profile", 14, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(82, 82, 91);
    doc.text(`${profile.position || "Role not set"} • ${selectedStore}`, 14, 43);

    autoTable(doc, {
      startY: 52,
      head: [["Employee Information", ""]],
      body: [
        ["Employee ID", profile.employee_id || "—"],
        ["ID Number", profile.id_number || "—"],
        ["Contact", profile.contact_number || "—"],
        ["Date of Birth", formatDate(profile.date_of_birth)],
        ["Joined", formatDate(profile.joined_date)],
        ["Training Status", trainingStatus],
        ["Emergency Contact", profile.emergency_contact_name || "—"],
        ["Emergency Phone", profile.emergency_contact_phone || "—"],
      ],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: BRAND_PURPLE, textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 }, 1: { cellWidth: 132 } },
      margin: { left: 14, right: 14 },
    });

    const docY = (doc.lastAutoTable?.finalY || 100) + 9;
    autoTable(doc, {
      startY: docY,
      head: [["Document Vault Status", "Uploaded"]],
      body:
        documents.length > 0
          ? documents.slice(0, 6).map((item) => [item.file_name || "Document", formatDate(item.uploaded_at)])
          : [["No documents uploaded", "—"]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });

    const assessmentY = (doc.lastAutoTable?.finalY || docY) + 9;
    autoTable(doc, {
      startY: assessmentY,
      head: [["Recent Assessment", "Assessor", "Score", "Outcome"]],
      body:
        assessments.length > 0
          ? assessments.slice(0, 5).map((row) => {
              const score = Number(read(row, ["score"], 0));
              return [
                `${formatDate(read(row, ["created_at"], ""))} • ${read(row, ["assessment_type"], "Assessment")}`,
                read(row, ["assessor_name", "assessor"], "—"),
                `${score}%`,
                score >= 80 ? "Pass" : "Fail",
              ];
            })
          : [["No assessments on file", "—", "—", "—"]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: BRAND_PURPLE, textColor: 255, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });

    const footerY = 285;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Astron Energy - ${selectedStore} • Generated ${new Date().toLocaleString("en-ZA")}`,
      14,
      footerY
    );
    doc.save(`${safeFilePart(profile.full_name)}-employee-file.pdf`);
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
                onClick={handlePrintEmployeeFile}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" strokeWidth={2} />
                Print Employee File
              </button>
              {isManager ? (
                <button
                  type="button"
                  onClick={removeProfile}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                  {deleting ? "Deleting…" : "Delete profile"}
                </button>
              ) : null}
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
