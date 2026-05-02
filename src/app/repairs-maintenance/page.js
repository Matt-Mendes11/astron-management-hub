"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

const PRIORITIES = ["Low", "Normal", "High"];

const priorityStyle = (p) => {
  const x = String(p || "").toLowerCase();
  if (x === "high") return "bg-red-100 text-red-800";
  if (x === "low") return "bg-slate-100 text-slate-700";
  return "bg-amber-50 text-amber-900";
};

const statusStyle = (s) =>
  String(s).toLowerCase() === "fixed" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-900";

export default function RepairsMaintenancePage() {
  const searchParams = useSearchParams();
  const selectedStore = STORES.includes(searchParams.get("store"))
    ? searchParams.get("store")
    : "Hillcrest";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fixingId, setFixingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    equipment_name: "",
    issue_description: "",
    priority: "Normal",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: qErr } = await supabase
      .from("maintenance_logs")
      .select("*")
      .eq("store_name", selectedStore)
      .order("reported_at", { ascending: false });

    if (qErr) {
      setError(qErr.message || "Could not load maintenance logs.");
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [selectedStore]);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    setForm({ equipment_name: "", issue_description: "", priority: "Normal" });
    setModalOpen(true);
  };

  const submitIssue = async () => {
    const equipment = form.equipment_name.trim();
    const desc = form.issue_description.trim();
    if (!equipment || !desc) {
      alert("Equipment name and issue description are required.");
      return;
    }
    setSaving(true);
    const { error: insErr } = await supabase.from("maintenance_logs").insert({
      store_name: selectedStore,
      equipment_name: equipment,
      issue_description: desc,
      priority: form.priority,
      status: "Pending",
    });
    setSaving(false);
    if (insErr) {
      alert(insErr.message || "Failed to log issue. Ensure the maintenance_logs table exists.");
      return;
    }
    setModalOpen(false);
    await load();
  };

  const markFixed = async (id) => {
    setFixingId(id);
    const { error: upErr } = await supabase.from("maintenance_logs").update({ status: "Fixed" }).eq("id", id);
    setFixingId(null);
    if (upErr) {
      alert(upErr.message || "Failed to update.");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#3c008b] to-[#5b21b6] text-white shadow-sm">
              <Wrench className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Repairs &amp; Maintenance</h2>
              <p className="mt-1 text-sm text-slate-600">
                Track equipment issues for <span className="font-semibold text-[#3c008b]">{selectedStore}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="rounded-xl bg-[#ff6e00] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
          >
            + Log Issue
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Open &amp; recent issues</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No maintenance logs yet. Log an issue to get started.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.equipment_name}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      <span className="line-clamp-2">{row.issue_description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle(
                          row.priority
                        )}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.reported_at
                        ? new Date(row.reported_at).toLocaleString("en-ZA", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {String(row.status).toLowerCase() === "pending" ? (
                        <button
                          type="button"
                          onClick={() => markFixed(row.id)}
                          disabled={fixingId === row.id}
                          className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {fixingId === row.id ? "Saving…" : "Mark as Fixed"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="maint-modal-title"
          >
            <h3 id="maint-modal-title" className="text-lg font-semibold text-slate-900">
              Log maintenance issue
            </h3>
            <p className="mt-1 text-sm text-slate-500">{selectedStore}</p>
            <div className="mt-5 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Equipment</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  value={form.equipment_name}
                  onChange={(e) => setForm((f) => ({ ...f, equipment_name: e.target.value }))}
                  placeholder="e.g. Pump 3, POS lane 2"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Issue description</span>
                <textarea
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  value={form.issue_description}
                  onChange={(e) => setForm((f) => ({ ...f, issue_description: e.target.value }))}
                  placeholder="Describe the fault / safety concern…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Priority</span>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitIssue}
                disabled={saving}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
