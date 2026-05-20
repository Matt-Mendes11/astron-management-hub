"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpRight } from "lucide-react";
import { labelToSlug } from "../lib/stores";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BRAND_PURPLE = "#3c008b";
const BRAND_ORANGE = "#ff6e00";
const DEFAULT_TANK_CAPACITY_L = 30000;
const DEFAULT_BRANCH = "Hillcrest";

const n = (v) => Number(v ?? 0);

const normalizeInvoiceStatus = (status) => {
  const normalized = String(status || "unpaid").trim().toLowerCase();
  if (normalized === "paid" || normalized === "unpaid") return normalized;
  return "unpaid";
};

const monthKeyForDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabelFromKey = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
};

const todayIso = () => new Date().toISOString().split("T")[0];

const normalizeCaps = (atg) => ({
  dsl1: Math.max(1, Math.round(n(atg?.tank_capacity_dsl1) || DEFAULT_TANK_CAPACITY_L)),
  dsl2: Math.max(1, Math.round(n(atg?.tank_capacity_dsl2) || DEFAULT_TANK_CAPACITY_L)),
  ulp1: Math.max(1, Math.round(n(atg?.tank_capacity_ulp1) || DEFAULT_TANK_CAPACITY_L)),
  ulp2: Math.max(1, Math.round(n(atg?.tank_capacity_ulp2) || DEFAULT_TANK_CAPACITY_L)),
});

const tankFillFractions = (atg) => {
  const caps = normalizeCaps(atg);
  const vols = {
    dsl1: n(atg?.dsl_tank1),
    dsl2: n(atg?.dsl_tank2),
    ulp1: n(atg?.ulp_tank1),
    ulp2: n(atg?.ulp_tank2),
  };
  return [
    vols.dsl1 / caps.dsl1,
    vols.dsl2 / caps.dsl2,
    vols.ulp1 / caps.ulp1,
    vols.ulp2 / caps.ulp2,
  ];
};

const checklistLine = (storeName, row, now = new Date()) => {
  const deadline = new Date(now);
  deadline.setHours(12, 0, 0, 0);

  if (row) {
    const completedAt = row.completed_at;
    const st = String(row.status || "").toLowerCase();
    if (st === "completed" || completedAt) {
      const t = completedAt
        ? new Date(completedAt).toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      return t ? `${storeName} — Completed at ${t}` : `${storeName} — Completed`;
    }
    return `${storeName} — Pending`;
  }

  if (now.getTime() > deadline.getTime()) {
    return `${storeName} — Overdue`;
  }
  return `${storeName} — Pending`;
};

function SummaryCard({ title, children, href }) {
  const router = useRouter();

  return (
    <div className="relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3c008b]/25 hover:shadow-md">
      <span
        className="absolute inset-x-0 top-0 h-1 rounded-t-2xl opacity-90"
        style={{
          background: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_ORANGE})`,
        }}
      />
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#3c008b]/90">{title}</p>
          <div className="mt-2 text-sm font-semibold leading-snug text-slate-900">{children}</div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#ff6e00]"
          aria-hidden
        >
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push(href)}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#3c008b]/15 bg-gradient-to-r from-[#faf5ff] to-[#fff7ed] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#3c008b] shadow-sm transition hover:border-[#ff6e00]/35 hover:bg-[#fff5eb] hover:text-[#c2410c]"
      >
        Go to module
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

export default function CommandCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store =
    searchParams.get("store") && ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"].includes(searchParams.get("store"))
      ? searchParams.get("store")
      : DEFAULT_BRANCH;

  const [loading, setLoading] = useState(true);
  const [hasAtgRow, setHasAtgRow] = useState(false);
  const [fuelWarn, setFuelWarn] = useState(false);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [checklistText, setChecklistText] = useState("—");
  const [noticeCount, setNoticeCount] = useState(0);
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [lowStaff, setLowStaff] = useState([]);
  const [highPendingMaintenance, setHighPendingMaintenance] = useState([]);

  const storeSlug = useMemo(() => labelToSlug(store), [store]);

  const load = useCallback(async () => {
    setLoading(true);
    const monthYear = monthLabelFromKey(monthKeyForDate());
    const today = todayIso();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      atgRes,
      unpaidInvoicesRes,
      checklistRes,
      noticesCountRes,
      assessmentsRes,
      staffRes,
      maintenanceRes,
    ] = await Promise.all([
      supabase.from("atg_readings").select("*").eq("store_name", store).eq("month_year", monthYear).maybeSingle(),
      supabase
        .from("payments")
        .select("id, supplier_name, amount, due_date, status")
        .eq("store_name", store)
        .eq("is_recurring", false),
      supabase.from("daily_checklists").select("*").eq("store_name", store).eq("check_date", today).maybeSingle(),
      supabase.from("notices").select("id", { count: "exact", head: true }).eq("branch_id", store),
      supabase
        .from("site_assessments")
        .select("id, staff_id, score, created_at")
        .eq("store_name", store)
        .not("staff_id", "is", null)
        .order("created_at", { ascending: false }),
      supabase.from("staff_profiles").select("id, full_name").eq("store_name", store),
      supabase
        .from("maintenance_logs")
        .select("id, equipment_name, priority, status")
        .eq("store_name", store)
        .eq("status", "Pending"),
    ]);

    const atg = atgRes.data;
    const atgOk = !atgRes.error && atg;
    setHasAtgRow(Boolean(atgOk));
    if (atgOk) {
      const fracs = tankFillFractions(atg);
      const anyLow = fracs.some((f) => !Number.isFinite(f) || f < 0.2);
      setFuelWarn(anyLow);
    } else {
      setFuelWarn(false);
    }

    const invoiceRows = unpaidInvoicesRes.error ? [] : unpaidInvoicesRes.data || [];
    const unpaidRows = invoiceRows.filter((row) => normalizeInvoiceStatus(row.status) === "unpaid");
    const unpaidSum = unpaidRows.reduce((s, row) => s + n(row.amount), 0);
    setUnpaidTotal(unpaidSum);

    const overdue = [];
    for (const inv of unpaidRows) {
      const due = inv.due_date ? new Date(inv.due_date) : null;
      if (due && !Number.isNaN(due.getTime()) && due < startOfToday) {
        overdue.push(inv);
      }
    }
    setOverdueInvoices(overdue);

    setChecklistText(
      checklistRes.error ? `${store} — Checklist unavailable` : checklistLine(store, checklistRes.data)
    );

    setNoticeCount(noticesCountRes.error ? 0 : noticesCountRes.count ?? 0);

    const staffById = Object.fromEntries((staffRes.data || []).map((s) => [String(s.id), s.full_name]));
    const latestByStaff = {};
    if (!assessmentsRes.error && assessmentsRes.data) {
      for (const row of assessmentsRes.data) {
        const sid = row.staff_id != null ? String(row.staff_id) : "";
        if (!sid) continue;
        if (!latestByStaff[sid]) latestByStaff[sid] = row;
      }
    }
    const low = Object.entries(latestByStaff)
      .filter(([, row]) => n(row.score) < 70)
      .map(([id, row]) => ({
        id,
        name: staffById[id] || "Staff member",
        score: Math.round(n(row.score)),
      }));
    setLowStaff(low);

    const maintRows = maintenanceRes.error ? [] : maintenanceRes.data || [];
    setHighPendingMaintenance(
      maintRows.filter((r) => String(r.priority).toLowerCase() === "high" && String(r.status).toLowerCase() === "pending")
    );

    setLoading(false);
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtMoney = (v) =>
    `R ${n(v).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const overdueSubtotal = useMemo(
    () => overdueInvoices.reduce((s, inv) => s + n(inv.amount), 0),
    [overdueInvoices]
  );

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Command Center</h2>
            <p className="mt-1 text-sm text-slate-600">
              At-a-glance status for <span className="font-semibold text-[#3c008b]">{store}</span> — updates when you
              change store.
            </p>
          </div>
          {loading ? (
            <span className="text-xs font-medium text-slate-400">Refreshing…</span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Fuel Status" href={`/${storeSlug}/fuel-management/fuel-plan`}>
            {loading ? (
              <span className="text-slate-400">Loading…</span>
            ) : !hasAtgRow ? (
              <span className="text-slate-600">No ATG row for this month — open Fuel Planner to add readings.</span>
            ) : fuelWarn ? (
              <span className="text-amber-800">Warning: one or more tanks below 20%</span>
            ) : (
              <span className="text-emerald-700">All Tanks Healthy</span>
            )}
          </SummaryCard>

          <SummaryCard title="Financials" href={`/${storeSlug}/admin-controls-sheet/payments?module=account-payments`}>
            {loading ? (
              <span className="text-slate-400">Loading…</span>
            ) : (
              <>
                <span className="block text-slate-600">Total unpaid (all open invoices)</span>
                <span className="mt-1 block text-lg tabular-nums text-slate-900">{fmtMoney(unpaidTotal)}</span>
              </>
            )}
          </SummaryCard>

          <SummaryCard title="Operations" href={`/${storeSlug}/routines-and-audits/site-assessments`}>
            {loading ? <span className="text-slate-400">Loading…</span> : <span>Daily Checklist · {checklistText}</span>}
          </SummaryCard>

          <SummaryCard title="Team" href={`/${storeSlug}/operations-team-hub`}>
            {loading ? (
              <span className="text-slate-400">Loading…</span>
            ) : (
              <>
                <span className="block text-slate-600">Active notices posted</span>
                <span className="mt-1 block text-2xl font-bold tabular-nums text-[#3c008b]">{noticeCount}</span>
              </>
            )}
          </SummaryCard>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-[#faf5ff] to-[#fff7ed] p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#3c008b]/10 pb-3">
          <span
            className="inline-flex h-8 w-1 rounded-full"
            style={{ background: `linear-gradient(180deg, ${BRAND_PURPLE}, ${BRAND_ORANGE})` }}
          />
          <h3 className="text-base font-semibold text-slate-900">Urgent Tasks</h3>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading priorities…</p>
        ) : (
          <>
            {highPendingMaintenance.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Maintenance</p>
                <ul className="space-y-1.5 text-sm font-semibold text-amber-950">
                  {highPendingMaintenance.map((m) => (
                    <li key={m.id}>⚠️ Maintenance: {m.equipment_name} needs repair.</li>
                  ))}
                </ul>
                <Link
                  href={`/${storeSlug}/repairs-maintenance`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff6e00] hover:underline"
                >
                  Open Repairs &amp; Maintenance <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            ) : null}

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#3c008b]">Overdue invoices</p>
                {overdueInvoices.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">None — no unpaid invoices past due date.</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-2">
                      {overdueInvoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-800">{inv.supplier_name || "Supplier"}</span>
                          <span className="font-semibold tabular-nums text-red-800">{fmtMoney(inv.amount)}</span>
                          <span className="w-full text-xs text-red-700/90">
                            Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-ZA") : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-semibold text-slate-700">
                      Overdue subtotal: <span className="tabular-nums text-red-800">{fmtMoney(overdueSubtotal)}</span>{" "}
                      <span className="font-normal text-slate-500">
                        (part of {fmtMoney(unpaidTotal)} total unpaid)
                      </span>
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/${storeSlug}/admin-controls-sheet/payments?module=account-payments`)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#ff6e00] hover:underline"
                >
                  Open Payments <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#3c008b]">
                  Staff below 70% (latest site_assessments row per person)
                </p>
                {lowStaff.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No staff flagged — latest scores are 70% or above.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {lowStaff.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/${storeSlug}/the-team/${s.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-[#ff6e00]/40"
                        >
                          <span>{s.name}</span>
                          <span className="tabular-nums text-amber-900">{s.score}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/${storeSlug}/the-team`)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#ff6e00] hover:underline"
                >
                  Staff directory <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
