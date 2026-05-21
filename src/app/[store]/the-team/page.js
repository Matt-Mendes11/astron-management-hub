"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useParams, useSearchParams } from "next/navigation";
import AppDrillBack from "../../../components/drilldown/AppDrillBack";
import StaffIdDocumentField from "../../../components/staff/StaffIdDocumentField";
import StaffProfileFormFields from "../../../components/staff/StaffProfileFormFields";
import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";
import {
  defaultStaffForm,
  formToStaffPayload,
  isStaffDocumentsSchemaError,
  STAFF_DOCUMENTS_SETUP_HINT,
  trainingStatusStyles,
  uploadStaffDocument,
  deleteStaffMember,
} from "../../../lib/staff";
import { Search, Trash2, UserPlus } from "lucide-react";
import { useAuthProfile } from "../../../lib/authProfile";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-ZA");
};

/** Initials from full name (e.g. Matthew Mendes → MM). */
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

function normalizeRoleCount(position, role) {
  const p = (position || "").trim().toLowerCase();
  return p === role.toLowerCase();
}

export default function StaffManagementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storeSlug = storeSlugFromRoute(params?.store, searchParams);
  const selectedStore = storeLabelFromRoute(params?.store, searchParams);
  const { isManager } = useAuthProfile();

  const backHref = useMemo(
    () => backHrefFromReturn(searchParams, `/${storeSlug}`),
    [searchParams, storeSlug]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(() => defaultStaffForm());
  const [addIdFile, setAddIdFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: qErr } = await supabase
      .from("staff_profiles")
      .select(
        "id, store_name, full_name, position, employee_id, joined_date, contact_number, training_status, created_at"
      )
      .eq("store_name", selectedStore)
      .order("full_name", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setStaff([]);
      setLoading(false);
      return;
    }
    setStaff(data || []);
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((row) => (row.full_name || "").toLowerCase().includes(q));
  }, [staff, searchQuery]);

  const metrics = useMemo(() => {
    const total = staff.length;
    const forecourt = staff.filter((r) => normalizeRoleCount(r.position, "Forecourt")).length;
    const shopAdminMgr = staff.filter((r) =>
      ["Shop", "Admin", "Manager"].some((role) => normalizeRoleCount(r.position, role))
    ).length;
    return { total, forecourt, shopAdminMgr };
  }, [staff]);

  const queryStore = `store=${encodeURIComponent(selectedStore)}`;

  const openAddModal = () => {
    setAddForm(defaultStaffForm());
    setAddIdFile(null);
    setAddOpen(true);
  };

  const saveNewMember = async () => {
    const name = addForm.full_name.trim();
    if (!name) {
      alert("Full name is required.");
      return;
    }
    setSaving(true);
    const payload = formToStaffPayload(addForm, selectedStore);
    payload.full_name = name;
    const { data: created, error: insErr } = await supabase
      .from("staff_profiles")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      setSaving(false);
      alert(insErr.message || "Could not save staff member.");
      return;
    }

    if (addIdFile && created?.id) {
      const uploadResult = await uploadStaffDocument(supabase, {
        staffId: created.id,
        storeName: selectedStore,
        file: addIdFile,
      });
      if (!uploadResult.ok) {
        setSaving(false);
        const schemaHint = isStaffDocumentsSchemaError(uploadResult.error)
          ? `\n\n${STAFF_DOCUMENTS_SETUP_HINT}`
          : "";
        alert(
          `Team member was saved, but the ID document could not be uploaded: ${uploadResult.error}${schemaHint}`
        );
        setAddOpen(false);
        setAddForm(defaultStaffForm());
        setAddIdFile(null);
        await loadStaff();
        return;
      }
    }

    setSaving(false);
    setAddOpen(false);
    setAddForm(defaultStaffForm());
    setAddIdFile(null);
    await loadStaff();
  };

  const removeMember = async (row) => {
    const name = row.full_name || "this team member";
    if (
      !window.confirm(
        `Delete ${name} from ${selectedStore}? Their profile and uploaded documents will be removed. Past assessments will stay but will no longer be linked to this profile.`
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    const result = await deleteStaffMember(supabase, { staffId: row.id, storeName: selectedStore });
    setDeletingId("");
    if (!result.ok) {
      alert(result.error || "Could not delete staff member.");
      return;
    }
    await loadStaff();
  };

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={backHref} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#311162]/80">
            People &amp; performance
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Staff Management</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Directory for <span className="font-semibold text-slate-800">{selectedStore}</span>. Add team members,
            review roles, and open employee files. Store context follows the header selector.
          </p>
        </section>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#ff6a00] to-[#ff8533] px-5 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition hover:brightness-105"
        >
          <UserPlus className="h-4 w-4" strokeWidth={2.25} />
          Add Team Member
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total team</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[#311162]">{metrics.total}</p>
          <p className="mt-1 text-xs text-slate-500">Active roster at this site</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Forecourt</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{metrics.forecourt}</p>
          <p className="mt-1 text-xs text-slate-500">Forecourt role assignments</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shop &amp; office</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{metrics.shopAdminMgr}</p>
          <p className="mt-1 text-xs text-slate-500">Shop, Admin &amp; Manager roles</p>
        </div>
      </div>

      {/* Directory */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Team directory</h3>
              <p className="text-xs text-slate-500">
                {filteredStaff.length} of {staff.length} shown
                {searchQuery.trim() ? ` · filtered by search` : ""}
              </p>
            </div>
            <div className="relative max-w-md flex-1 lg:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
              />
              <input
                type="search"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none ring-slate-200 transition placeholder:text-slate-400 focus:border-[#ff6e00] focus:ring-2 focus:ring-[#ff6e00]/20"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm font-medium text-slate-500">Loading directory…</div>
          ) : staff.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-600">No team members yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Use <span className="font-semibold text-slate-700">Add Team Member</span> to create your first profile.
              </p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">No names match your search.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5">Team member</th>
                  <th className="px-5 py-3.5">Position</th>
                  <th className="hidden px-5 py-3.5 md:table-cell">Employee ID</th>
                  <th className="hidden px-5 py-3.5 lg:table-cell">Contact</th>
                  <th className="hidden px-5 py-3.5 sm:table-cell">Joined</th>
                  <th className="hidden px-5 py-3.5 lg:table-cell">Training</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner ring-2 ring-white"
                          style={avatarGradient(row.full_name)}
                          aria-hidden
                        >
                          {initialsFromName(row.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{row.full_name}</span>
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                              Active
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 md:hidden">
                            {row.employee_id ? `ID ${row.employee_id}` : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {row.position || "—"}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{row.employee_id || "—"}</td>
                    <td className="hidden px-5 py-4 text-slate-600 lg:table-cell">{row.contact_number || "—"}</td>
                    <td className="hidden px-5 py-4 text-slate-600 sm:table-cell">{formatDate(row.joined_date)}</td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${trainingStatusStyles(
                          row.training_status
                        )}`}
                      >
                        {row.training_status || "Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/${storeSlug}/the-team/${row.id}?${queryStore}${
                            searchParams.get("return")
                              ? `&return=${encodeURIComponent(searchParams.get("return"))}`
                              : ""
                          }`}
                          className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition hover:border-[#311162]/30 hover:bg-slate-50"
                        >
                          View file
                        </Link>
                        {isManager ? (
                          <button
                            type="button"
                            onClick={() => removeMember(row)}
                            disabled={deletingId === row.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            {deletingId === row.id ? "Deleting…" : "Delete"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add member modal */}
      {addOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div
            className="flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-title"
          >
            <div className="shrink-0 border-b border-slate-100 px-6 py-5">
              <h3 id="add-staff-title" className="text-lg font-bold text-slate-900">
                Add team member
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                New profile for <strong className="text-slate-700">{selectedStore}</strong>
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <StaffProfileFormFields form={addForm} setForm={setAddForm} />
              <StaffIdDocumentField
                file={addIdFile}
                onFileChange={setAddIdFile}
                storeName={selectedStore}
                disabled={saving}
              />
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewMember}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-[#ff6a00] to-[#ff8533] px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save member"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
