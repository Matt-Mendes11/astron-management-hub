"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import AppDrillBack from "../../components/drilldown/AppDrillBack";
import { labelToSlug } from "../../lib/stores";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const CHART_ORANGE = "#ff6e00";
const CHART_PURPLE = "#3c008b";
const PIE_COLORS = ["#ff6e00", "#3c008b", "#1d4ed8", "#059669", "#9333ea", "#ea580c", "#0f766e"];

const emptyInvoiceForm = {
  supplierName: "",
  invoiceDate: "",
  dueDate: "",
  amount: "",
  notes: "",
  status: "unpaid",
};

const emptyRecurringForm = {
  supplierName: "",
  dueDayOfMonth: "",
  amount: "",
  notes: "",
};

const toNum = (value) => Number(value ?? 0);

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDate = (value) => {
  const date = safeDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
};

const periodFromParts = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

const periodLabel = (year, monthIndex) => `${MONTHS[monthIndex]} ${year}`;

const isoDate = (date) => {
  if (!(date instanceof Date)) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const normalizeStatus = (status) => {
  const normalized = String(status || "unpaid").trim().toLowerCase();
  if (normalized === "paid" || normalized === "unpaid") return normalized;
  return "unpaid";
};

const monthRange = (year, monthIndex) => {
  const start = isoDate(new Date(year, monthIndex, 1));
  const end = isoDate(new Date(year, monthIndex, daysInMonth(year, monthIndex)));
  return { start, end };
};

const normalizeInvoice = (row) => ({
  id: String(row.id),
  supplierName: String(row.supplier_name || ""),
  invoiceDate: row.invoice_date || "",
  dueDate: row.due_date || "",
  amount: Number(row.amount || 0),
  notes: String(row.notes || ""),
  status: normalizeStatus(row.status),
  isVirtual: false,
});

const normalizeRecurring = (row) => ({
  id: String(row.id),
  supplierName: String(row.supplier_name || ""),
  dueDayOfMonth: Number(row.recurring_day || 0),
  amount: Number(row.amount || 0),
  notes: String(row.notes || ""),
});

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const selectedStore = searchParams.get("store") || "Hillcrest";
  const backHref = useMemo(() => {
    const r = searchParams.get("return");
    if (r) {
      try {
        return decodeURIComponent(r);
      } catch {
        return r;
      }
    }
    return `/${labelToSlug(selectedStore)}/admin-controls-sheet`;
  }, [searchParams, selectedStore]);
  const today = useMemo(() => new Date(), []);
  const now = useMemo(() => new Date(), []);

  const [activeTab, setActiveTab] = useState("invoices");
  const [view, setView] = useState("hub");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dbInvoices, setDbInvoices] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState("");
  const [editingRecurringId, setEditingRecurringId] = useState("");
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
  const [recurringForm, setRecurringForm] = useState(emptyRecurringForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");

  const adminCards = [
    { id: "account-payments", title: "Account Payments", enabled: true },
    { id: "glocell-invoices", title: "Glocell Invoices", enabled: false },
    { id: "credits-owing", title: "Credits Owing", enabled: false },
    { id: "supplier-statement", title: "Supplier Statement", enabled: false },
    { id: "payment-plan", title: "Payment Plan", enabled: false },
    { id: "deductions", title: "Deductions", enabled: false },
    { id: "banking-recon", title: "Banking Recon", enabled: false },
  ];

  const period = periodFromParts(year, month);
  const currentMonthRange = useMemo(() => monthRange(year, month), [year, month]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");

    const invoicesQuery = supabase
      .from("payments")
      .select("*")
      .eq("store_name", selectedStore)
      .eq("is_recurring", false)
      .gte("invoice_date", currentMonthRange.start)
      .lte("invoice_date", currentMonthRange.end)
      .order("created_at", { ascending: false });
    const recurringQuery = supabase
      .from("payments")
      .select("*")
      .eq("store_name", selectedStore)
      .eq("is_recurring", true)
      .order("supplier_name", { ascending: true });

    const [invoicesRes, recurringRes] = await Promise.all([invoicesQuery, recurringQuery]);

    if (invoicesRes.error || recurringRes.error) {
      setError(invoicesRes.error?.message || recurringRes.error?.message || "Failed to load payments.");
      setDbInvoices([]);
      setRecurring([]);
      setLoading(false);
      return;
    }

    setDbInvoices((invoicesRes.data || []).map(normalizeInvoice));
    setRecurring((recurringRes.data || []).map(normalizeRecurring));
    setLoading(false);
  }, [selectedStore, currentMonthRange.end, currentMonthRange.start]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const persistInvoice = async (record, id = "") => {
    const payload = {
      store_name: selectedStore,
      supplier_name: record.supplierName,
      amount: toNum(record.amount),
      invoice_date: record.invoiceDate || null,
      due_date: record.dueDate || null,
      status: normalizeStatus(record.status),
      is_recurring: false,
      recurring_day: null,
      notes: record.notes || null,
    };
    return id
      ? supabase.from("payments").update(payload).eq("id", id).select("id").maybeSingle()
      : supabase.from("payments").insert(payload).select("id").maybeSingle();
  };

  const persistRecurring = async (record, id = "") => {
    const payload = {
      store_name: selectedStore,
      supplier_name: record.supplierName,
      amount: toNum(record.amount),
      invoice_date: null,
      due_date: null,
      status: "unpaid",
      is_recurring: true,
      recurring_day: Number(record.dueDayOfMonth),
      notes: record.notes || null,
    };
    return id
      ? supabase.from("payments").update(payload).eq("id", id).select("id").maybeSingle()
      : supabase.from("payments").insert(payload).select("id").maybeSingle();
  };

  const virtualRecurringInvoices = useMemo(() => {
    if (!recurring.length) return [];
    const monthInvoices = dbInvoices;
    return recurring
      .filter((template) => {
        const dueDay = Math.min(Math.max(Number(template.dueDayOfMonth || 1), 1), daysInMonth(year, month));
        const dueIso = isoDate(new Date(year, month, dueDay));
        const exists = monthInvoices.some(
          (invoice) =>
            invoice.supplierName.trim().toLowerCase() === template.supplierName.trim().toLowerCase() &&
            toNum(invoice.amount) === toNum(template.amount) &&
            invoice.dueDate === dueIso
        );
        return !exists;
      })
      .map((template) => {
        const dueDay = Math.min(Math.max(Number(template.dueDayOfMonth || 1), 1), daysInMonth(year, month));
        const dueIso = isoDate(new Date(year, month, dueDay));
        return {
          id: `virtual-${template.id}-${period}`,
          supplierName: template.supplierName,
          invoiceDate: dueIso,
          dueDate: dueIso,
          amount: toNum(template.amount),
          notes: template.notes,
          status: "unpaid",
          isVirtual: true,
          sourceRecurringId: template.id,
        };
      });
  }, [dbInvoices, recurring, year, month, period]);

  const periodInvoices = useMemo(
    () => [...dbInvoices, ...virtualRecurringInvoices].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    [dbInvoices, virtualRecurringInvoices]
  );
  const filteredInvoices = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return periodInvoices;
    return periodInvoices.filter((invoice) =>
      String(invoice.supplierName || "").toLowerCase().includes(search)
    );
  }, [periodInvoices, searchQuery]);

  const monthlyTotalDue = useMemo(
    () =>
      periodInvoices
        .filter((invoice) => invoice.status === "unpaid")
        .reduce((sum, invoice) => sum + toNum(invoice.amount), 0),
    [periodInvoices]
  );
  const supplierSpendData = useMemo(() => {
    const totals = {};
    dbInvoices.forEach((invoice) => {
      const key = String(invoice.supplierName || "Unknown");
      totals[key] = (totals[key] || 0) + toNum(invoice.amount);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [dbInvoices]);
  const weeklyCashRequirements = useMemo(() => {
    const buckets = [
      { name: "This Week", total: 0 },
      { name: "Next Week", total: 0 },
      { name: "Week 3", total: 0 },
      { name: "Week 4", total: 0 },
    ];
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    dbInvoices
      .filter((invoice) => invoice.status === "unpaid")
      .forEach((invoice) => {
        const due = safeDate(invoice.dueDate || invoice.invoiceDate);
        const amount = toNum(invoice.amount);
        if (!due || amount <= 0) return;
        const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const dayDiff = Math.floor((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
        if (dayDiff <= 6) buckets[0].total += amount;
        else if (dayDiff <= 13) buckets[1].total += amount;
        else if (dayDiff <= 20) buckets[2].total += amount;
        else if (dayDiff <= 27) buckets[3].total += amount;
      });

    return buckets;
  }, [dbInvoices, today]);

  const openEditInvoice = (invoice) => {
    setEditingInvoiceId(invoice.id);
    setInvoiceForm({
      supplierName: invoice.supplierName,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      amount: String(invoice.amount || ""),
      notes: invoice.notes || "",
      status: invoice.status || "unpaid",
    });
    setActiveTab("add");
  };

  const submitInvoice = async () => {
    const supplierName = invoiceForm.supplierName.trim();
    const amount = Number(invoiceForm.amount);
    if (!supplierName || !Number.isFinite(amount) || amount <= 0) {
      alert("Supplier Name and Amount are required.");
      return;
    }
    if (!invoiceForm.invoiceDate) {
      alert("CRV Date is required.");
      return;
    }

    setSaving(true);
    const record = {
      supplierName,
      invoiceDate: invoiceForm.invoiceDate,
      dueDate: invoiceForm.dueDate,
      amount,
      notes: invoiceForm.notes.trim(),
      status: normalizeStatus(invoiceForm.status),
    };

    const { error: saveError } = await persistInvoice(record, editingInvoiceId);
    setSaving(false);
    if (saveError) {
      alert(saveError.message || "Failed to save invoice.");
      return;
    }
    setEditingInvoiceId("");
    setInvoiceForm(emptyInvoiceForm);
    setActiveTab("invoices");
    await loadPayments();
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    const { error: deleteError } = await supabase.from("payments").delete().eq("id", id);
    if (deleteError) {
      alert(deleteError.message || "Failed to delete invoice.");
      return;
    }
    if (editingInvoiceId === id) {
      setEditingInvoiceId("");
      setInvoiceForm(emptyInvoiceForm);
      setActiveTab("invoices");
    }
    await loadPayments();
  };

  const toggleInvoiceStatus = async (invoice) => {
    if (invoice.isVirtual) return;
    if (statusUpdatingId) return;
    const nextStatus = invoice.status === "paid" ? "unpaid" : "paid";
    const previousStatus = invoice.status;
    setStatusUpdatingId(invoice.id);
    setDbInvoices((prev) =>
      prev.map((row) => (row.id === invoice.id ? { ...row, status: nextStatus } : row))
    );
    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: nextStatus })
      .eq("id", invoice.id);
    if (updateError) {
      setDbInvoices((prev) =>
        prev.map((row) => (row.id === invoice.id ? { ...row, status: previousStatus } : row))
      );
      alert(updateError.message || "Failed to update status.");
    }
    setStatusUpdatingId("");
  };

  const openEditRecurring = (entry) => {
    setEditingRecurringId(entry.id);
    setRecurringForm({
      supplierName: entry.supplierName,
      dueDayOfMonth: String(entry.dueDayOfMonth || ""),
      amount: String(entry.amount || ""),
      notes: entry.notes || "",
    });
  };

  const submitRecurring = async () => {
    const supplierName = recurringForm.supplierName.trim();
    const day = Number(recurringForm.dueDayOfMonth);
    const amount = Number(recurringForm.amount || 0);
    if (!supplierName || !Number.isFinite(day) || day < 1 || day > 31) {
      alert("Supplier Name and a valid due day (1-31) are required.");
      return;
    }

    setSaving(true);
    const { error: saveError } = await persistRecurring(
      {
        supplierName,
        dueDayOfMonth: day,
        amount,
        notes: recurringForm.notes.trim(),
      },
      editingRecurringId
    );
    setSaving(false);
    if (saveError) {
      alert(saveError.message || "Failed to save recurring payment.");
      return;
    }
    setEditingRecurringId("");
    setRecurringForm(emptyRecurringForm);
    await loadPayments();
  };

  const deleteRecurring = async (id) => {
    if (!window.confirm("Remove this recurring payment?")) return;
    const { error: deleteError } = await supabase.from("payments").delete().eq("id", id);
    if (deleteError) {
      alert(deleteError.message || "Failed to remove recurring payment.");
      return;
    }
    if (editingRecurringId === id) {
      setEditingRecurringId("");
      setRecurringForm(emptyRecurringForm);
    }
    await loadPayments();
  };

  const onPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((v) => v - 1);
      return;
    }
    setMonth((v) => v - 1);
  };

  const onNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((v) => v + 1);
      return;
    }
    setMonth((v) => v + 1);
  };

  const daysLeftMeta = (dueDate) => {
    const due = safeDate(dueDate);
    if (!due) return { label: "—", className: "bg-slate-100 text-slate-600" };
    const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const midnightDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.ceil((midnightDue - midnightToday) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return { label: "Overdue", className: "bg-red-100 text-red-700" };
    if (diff < 7) return { label: `${diff} day${diff === 1 ? "" : "s"}`, className: "bg-amber-100 text-amber-700" };
    return { label: `${diff} day${diff === 1 ? "" : "s"}`, className: "bg-emerald-100 text-emerald-700" };
  };

  const addVirtualToMonth = async (invoice) => {
    if (!invoice?.isVirtual) return;
    const { error: saveError } = await persistInvoice(
      {
        supplierName: invoice.supplierName,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        amount: invoice.amount,
        notes: invoice.notes,
        status: "unpaid",
      },
      ""
    );
    if (saveError) {
      alert(saveError.message || "Failed to add recurring invoice.");
      return;
    }
    await loadPayments();
  };

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={backHref} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ff6e00]/10 text-[#ff6e00]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19h16" />
              <path d="M4 5h16" />
              <path d="M7 5v14" />
              <path d="M17 5v14" />
              <path d="M10 9h4" />
              <path d="M10 13h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Admin Controls Sheet</h2>
            <p className="text-sm text-slate-600">{selectedStore} finance and payment controls</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div>
        <div
          className={`grid grid-cols-1 gap-6 transition-all duration-300 ease-out ${
            view === "planner"
              ? "pointer-events-none hidden opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">Payments Controls Hub</h3>
              <p className="text-sm text-slate-500">Select a module to open financial workflows.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {adminCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  title={card.enabled ? card.title : "Coming Soon"}
                  onClick={() => {
                    if (card.enabled) setView("planner");
                  }}
                  className={`group relative rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
                    card.enabled
                      ? "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
                      : "cursor-not-allowed border-slate-200/80 opacity-80"
                  }`}
                >
                  <p
                    className={`text-base font-semibold ${
                      card.enabled ? "text-[#ff6e00]" : "text-slate-400"
                    }`}
                  >
                    {card.title}
                  </p>
                  <p className={`mt-2 text-xs ${card.enabled ? "text-slate-500" : "text-slate-400"}`}>
                    {card.enabled ? "Open P-Planner workflow" : "Module planned for roadmap"}
                  </p>
                  {!card.enabled ? (
                    <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      Coming Soon
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div
          className={`transition-all duration-300 ease-out ${
            view === "planner"
              ? "translate-x-0 opacity-100"
              : "pointer-events-none hidden translate-x-4 opacity-0"
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Back to Admin Controls
              </button>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Unpaid</p>
                <p className="text-lg font-bold text-[#a32d2d]">
                  R{" "}
                  {monthlyTotalDue.toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</span>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#ff6e00]"
                >
                  {Array.from({ length: 10 }, (_, index) => now.getFullYear() - 3 + index).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#ff6e00]"
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {periodLabel(year, month)}
                </span>
                <button
                  type="button"
                  onClick={onPrevMonth}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={onNextMonth}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Next
                </button>
                <span className="text-xs text-slate-500">{periodInvoices.length} invoice(s)</span>
              </div>
            </section>

            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <Tabs.List className="inline-flex w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <Tabs.Trigger
            value="invoices"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Invoices
          </Tabs.Trigger>
          <Tabs.Trigger
            value="add"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            + Add Invoice
          </Tabs.Trigger>
          <Tabs.Trigger
            value="recurring"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Recurring
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="invoices">
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-slate-800">Total Spend by Supplier</h4>
                  <p className="text-xs text-slate-500">Current month distribution</p>
                </div>
                <div className="h-52">
                  {supplierSpendData.length === 0 ? (
                    <div className="grid h-full place-items-center text-xs text-slate-500">
                      No supplier spend data this month.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={supplierSpendData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={42}
                          outerRadius={74}
                          paddingAngle={2}
                        >
                          {supplierSpendData.map((entry, idx) => (
                            <Cell key={`${entry.name}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) =>
                            `R ${Number(value || 0).toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2">
                  <h4 className="text-sm font-semibold text-slate-800">Weekly Cash Requirements</h4>
                  <p className="text-xs text-slate-500">Unpaid invoice totals by upcoming week</p>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyCashRequirements} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `R ${Number(value).toLocaleString("en-ZA")}`}
                      />
                      <Tooltip
                        formatter={(value) =>
                          `R ${Number(value || 0).toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        }
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} fill={CHART_ORANGE}>
                        {weeklyCashRequirements.map((entry, idx) => (
                          <Cell key={`bar-${entry.name}`} fill={idx % 2 === 0 ? CHART_ORANGE : CHART_PURPLE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search supplier name..."
                className="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#ff6e00]"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                    <th className="px-4 py-3 text-left font-semibold">CRV Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount (R)</th>
                    <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                    <th className="px-4 py-3 text-left font-semibold">Days Left</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                        No invoices found for {periodLabel(year, month)}.
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setActiveTab("add")}
                            className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            + Add First Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const dueMeta =
                        invoice.status === "paid"
                          ? { label: "✓ Settled", className: "bg-emerald-100 text-emerald-700" }
                          : daysLeftMeta(invoice.dueDate);
                      return (
                        <tr
                          key={invoice.id}
                          className={`border-t border-slate-100 ${invoice.status === "paid" ? "bg-emerald-50/30" : ""}`}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-800">{invoice.supplierName || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(invoice.invoiceDate)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(invoice.dueDate)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            R{" "}
                            {toNum(invoice.amount).toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-slate-600" title={invoice.notes}>
                            {invoice.notes || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${dueMeta.className}`}>
                              {dueMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleInvoiceStatus(invoice)}
                              disabled={invoice.isVirtual || statusUpdatingId === invoice.id}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                invoice.status === "paid"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              } ${invoice.isVirtual ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {statusUpdatingId === invoice.id ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : null}
                              {invoice.status === "paid" ? "Paid" : "Unpaid"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {invoice.isVirtual ? (
                                <button
                                  type="button"
                                  onClick={() => addVirtualToMonth(invoice)}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                                >
                                  Add To Month
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditInvoice(invoice)}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteInvoice(invoice.id)}
                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            </section>
          </div>
        </Tabs.Content>

        <Tabs.Content value="add">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingInvoiceId ? "Edit Invoice" : `New Invoice — ${periodLabel(year, month)}`}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Supplier Name *</span>
                <input
                  value={invoiceForm.supplierName}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({ ...prev, supplierName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">CRV Date</span>
                <input
                  type="date"
                  value={invoiceForm.invoiceDate}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">Due Date</span>
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">Amount (R) *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">Status</span>
                <select
                  value={invoiceForm.status}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Remarks</span>
                <input
                  value={invoiceForm.notes}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={submitInvoice}
                disabled={saving}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : editingInvoiceId ? "Save Changes" : "Add Invoice"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInvoiceId("");
                  setInvoiceForm(emptyInvoiceForm);
                  setActiveTab("invoices");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {editingInvoiceId ? (
                <button
                  type="button"
                  onClick={() => deleteInvoice(editingInvoiceId)}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete Invoice
                </button>
              ) : null}
            </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="recurring">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-left font-semibold">Due Day</th>
                      <th className="px-4 py-3 text-left font-semibold">Typical Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                          No recurring payments set up yet.
                        </td>
                      </tr>
                    ) : (
                      recurring.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-800">{entry.supplierName || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{entry.dueDayOfMonth || "—"}</td>
                          <td className="px-4 py-3 text-slate-900">
                            {toNum(entry.amount).toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{entry.notes || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditRecurring(entry)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRecurring(entry.id)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingRecurringId ? "Edit Recurring Payment" : "New Recurring Payment"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Recurring templates automatically generate invoices in the selected period.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Supplier Name *</span>
                  <input
                    value={recurringForm.supplierName}
                    onChange={(event) =>
                      setRecurringForm((prev) => ({ ...prev, supplierName: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Due Day of Month *</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={recurringForm.dueDayOfMonth}
                    onChange={(event) =>
                      setRecurringForm((prev) => ({ ...prev, dueDayOfMonth: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Typical Amount (R)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={recurringForm.amount}
                    onChange={(event) =>
                      setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Remarks</span>
                  <input
                    value={recurringForm.notes}
                    onChange={(event) =>
                      setRecurringForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                  />
                </label>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitRecurring}
                  disabled={saving}
                  className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingRecurringId ? "Save Changes" : "Add Recurring Payment"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecurringId("");
                    setRecurringForm(emptyRecurringForm);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        </Tabs.Content>
            </Tabs.Root>
          </div>
        </div>
      </div>
    </div>
  );
}
