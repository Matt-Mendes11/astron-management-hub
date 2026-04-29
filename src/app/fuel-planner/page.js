"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams } from "next/navigation";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export const dynamic = 'force-dynamic';
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const n = (v) => Number(v ?? 0);
const formatDay = (dateValue) => {
  if (!dateValue) return "-";
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return String(dateValue);
  return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
};
const formatIsoDate = (dateValue) => {
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const monthKeyFor = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
};
const monthDayCount = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
const STORE_OPTIONS = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

const BRAND_PURPLE = [60, 0, 139];
const BRAND_ORANGE = [255, 110, 0];
const KL_TO_LITERS = 1000;
const EXECUTIVE_NAVY = "#1e3a8a";
const EXECUTIVE_FOREST = "#059669";

const klInputToLiters = (value) => Math.round(n(value) * KL_TO_LITERS);
const litersToKlInput = (value) => {
  const liters = n(value);
  if (!liters) return "";
  const kl = liters / KL_TO_LITERS;
  return Number.isInteger(kl) ? String(kl) : String(Number(kl.toFixed(3)));
};
const readMetricField = (row, keys) => {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] != null) {
      return row[key];
    }
  }
  return 0;
};
const resolveMetricColumn = (row, keys) => {
  if (!row) return keys[0];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return key;
  }
  return keys[0];
};
const commitPlannerInputOnEnter = (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.currentTarget.blur();
};
const buildDailyMetricPayloadVariants = (storeName, date, row, existingMetricRow = null) => {
  const forecastDsl = klInputToLiters(row.forecast_dsl);
  const forecastUlp = klInputToLiters(row.forecast_ulp);
  const actualDsl = klInputToLiters(row.actual_dsl);
  const actualUlp = klInputToLiters(row.actual_ulp);
  const orderedBy = row.ordered_by?.trim() || null;

  const dynamicPayload = {
    store_name: storeName,
    reading_date: date,
    [resolveMetricColumn(existingMetricRow, [
      "forecast_dsl",
      "dsl_forecast",
      "forecast_sales_dsl",
    ])]: forecastDsl,
    [resolveMetricColumn(existingMetricRow, [
      "forecast_ulp",
      "ulp_forecast",
      "forecast_sales_ulp",
      "forecast_petrol",
      "forecast_ulp_liters",
    ])]: forecastUlp,
    [resolveMetricColumn(existingMetricRow, [
      "actual_dsl",
      "dsl_actual",
      "actual_sales_dsl",
    ])]: actualDsl,
    [resolveMetricColumn(existingMetricRow, [
      "actual_ulp",
      "ulp_actual",
      "actual_sales_ulp",
      "actual_petrol",
      "actual_ulp_liters",
    ])]: actualUlp,
    [resolveMetricColumn(existingMetricRow, ["ordered_by", "orderedBy"])]: orderedBy,
  };

  return [
    dynamicPayload,
    {
      store_name: storeName,
      reading_date: date,
      forecast_dsl: forecastDsl,
      forecast_ulp: forecastUlp,
      actual_dsl: actualDsl,
      actual_ulp: actualUlp,
      ordered_by: orderedBy,
    },
    {
      store_name: storeName,
      reading_date: date,
      dsl_forecast: forecastDsl,
      ulp_forecast: forecastUlp,
      dsl_actual: actualDsl,
      ulp_actual: actualUlp,
      ordered_by: orderedBy,
    },
    {
      store_name: storeName,
      reading_date: date,
      forecast_sales_dsl: forecastDsl,
      forecast_sales_ulp: forecastUlp,
      actual_sales_dsl: actualDsl,
      actual_sales_ulp: actualUlp,
      ordered_by: orderedBy,
    },
    {
      store_name: storeName,
      reading_date: date,
      forecast_dsl: forecastDsl,
      forecast_ulp: forecastUlp,
      actual_dsl: actualDsl,
      actual_petrol: actualUlp,
      ordered_by: orderedBy,
    },
  ];
};

function plannerRowVariance(row) {
  const fcDslL = klInputToLiters(row.forecast_dsl);
  const fcUlpL = klInputToLiters(row.forecast_ulp);
  return {
    dsl: klInputToLiters(row.actual_dsl) - fcDslL,
    ulp: klInputToLiters(row.actual_ulp) - fcUlpL,
  };
}

function StockProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const uniqueBySeries = {};
  payload.forEach((entry) => {
    if (!entry?.dataKey || entry.value == null) return;
    uniqueBySeries[entry.dataKey] = entry;
  });
  const dslEntry = uniqueBySeries.dsl;
  const ulpEntry = uniqueBySeries.ulp;

  return (
    <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-slate-800">Day {label}</p>
      {dslEntry ? (
        <p className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXECUTIVE_NAVY }} />
          DSL: {Number(dslEntry.value).toLocaleString("en-ZA")}L
        </p>
      ) : null}
      {ulpEntry ? (
        <p className="mt-1 flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXECUTIVE_FOREST }} />
          ULP: {Number(ulpEntry.value).toLocaleString("en-ZA")}L
        </p>
      ) : null}
    </div>
  );
}

function generateMonthlyAuditPdf({
  storeName,
  periodLabel,
  monthKeyForFilename,
  monthlyTotals,
  monthlyGrossProfit,
  plannerState,
  plannerRows,
  orderByDate,
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const totalSalesL = monthlyTotals.dsl + monthlyTotals.ulp;
  const totalOrderedL = plannerState.orders.reduce(
    (s, o) => s + n(o.dslVolume) + n(o.ulpVolume),
    0
  );
  const totalLitres = monthlyTotals.dsl + monthlyTotals.ulp;
  const dslMargin = n(plannerState.pricing.newRetailDsl) - n(plannerState.pricing.newCostDsl);
  const ulpMargin = n(plannerState.pricing.newRetailUlp) - n(plannerState.pricing.newCostUlp);
  const avgMarginPerL =
    totalLitres > 0 ? monthlyGrossProfit / totalLitres : (dslMargin + ulpMargin) / 2;

  const drawBrandedHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_PURPLE);
    doc.text(`ASTRON FRESHSTOP — ${storeName}`, margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Monthly operational audit • ${periodLabel}`, margin, 18);
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(0.55);
    doc.line(margin, 21, pageW - margin, 21);
    doc.setTextColor(0, 0, 0);
  };

  drawBrandedHeader();

  let y = 27;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Summary", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Total sales for the month: ${totalSalesL.toLocaleString("en-ZA")} L (DSL ${monthlyTotals.dsl.toLocaleString("en-ZA")} L + ULP ${monthlyTotals.ulp.toLocaleString("en-ZA")} L)`,
    margin,
    y
  );
  y += 5;
  doc.text(`Total fuel ordered (month): ${totalOrderedL.toLocaleString("en-ZA")} L`, margin, y);
  y += 5;
  doc.text(
    `Average margin: R ${avgMarginPerL.toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} / L (volume-weighted where sales recorded)`,
    margin,
    y
  );
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Monthly planner — daily sales & variances", margin, y);
  y += 5;

  const head = [
    [
      "Day",
      "Fcst DSL (kL)",
      "Fcst ULP (kL)",
      "Actual DSL (L)",
      "Actual ULP (L)",
      "Var DSL (L)",
      "Var ULP (L)",
      "Ord DSL (L)",
      "Ord ULP (L)",
      "Ref no.",
      "Status",
      "Ordered by",
    ],
  ];

  const body = plannerRows.map((row) => {
    const od = orderByDate[row.date];
    const v = plannerRowVariance(row);
    const fmt = (x) => (Number.isFinite(x) ? x.toLocaleString("en-ZA") : "—");
    return [
      formatDay(row.date),
      row.forecast_dsl !== "" && row.forecast_dsl != null ? String(row.forecast_dsl) : "—",
      row.forecast_ulp !== "" && row.forecast_ulp != null ? String(row.forecast_ulp) : "—",
      row.actual_dsl !== "" && row.actual_dsl != null
        ? klInputToLiters(row.actual_dsl).toLocaleString("en-ZA")
        : "—",
      row.actual_ulp !== "" && row.actual_ulp != null
        ? klInputToLiters(row.actual_ulp).toLocaleString("en-ZA")
        : "—",
      fmt(v.dsl),
      fmt(v.ulp),
      od?.dslVolume != null && n(od.dslVolume) > 0 ? n(od.dslVolume).toLocaleString("en-ZA") : "—",
      od?.ulpVolume != null && n(od.ulpVolume) > 0 ? n(od.ulpVolume).toLocaleString("en-ZA") : "—",
      od?.orderReference ? String(od.orderReference) : "—",
      od ? (od.confirmed ? "Confirmed" : "Ordered") : "—",
      row.ordered_by ? String(row.ordered_by) : "—",
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { top: 24, left: margin, right: margin, bottom: 14 },
    styles: {
      fontSize: 7,
      cellPadding: 1.4,
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND_PURPLE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    showHead: "everyPage",
    willDrawPage: (data) => {
      if (data.pageNumber <= 1) return;
      const d = data.doc;
      d.setFont("helvetica", "bold");
      d.setFontSize(14);
      d.setTextColor(...BRAND_PURPLE);
      d.text(`ASTRON FRESHSTOP — ${storeName}`, margin, 12);
      d.setFont("helvetica", "normal");
      d.setFontSize(9);
      d.setTextColor(80);
      d.text(`Monthly operational audit • ${periodLabel}`, margin, 18);
      d.setDrawColor(...BRAND_ORANGE);
      d.setLineWidth(0.55);
      d.line(margin, 21, pageW - margin, 21);
      d.setTextColor(0, 0, 0);
    },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(
      "Astron Energy — Regional Terminal Portal • Confidential — For internal business use only",
      margin,
      pageH - 7
    );
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin - 22, pageH - 7);
    doc.setTextColor(0, 0, 0);
  }

  const safeMonth = monthKeyForFilename.replace(/[^\d-]/g, "") || "month";
  doc.save(`Astron-FreshStop-Audit-${String(storeName).replace(/\s+/g, "-")}-${safeMonth}.pdf`);
}

const createDefaultPlannerState = () => ({
  atg: {
    dsl1: 0,
    dsl2: 0,
    ulp1: 0,
    ulp2: 0,
    dsl1ManualDip: 0,
    dsl2ManualDip: 0,
    ulp1ManualDip: 0,
    ulp2ManualDip: 0,
  },
  orders: [],
  pricing: {
    oldCostDsl: "0",
    oldCostUlp: "0",
    newCostDsl: "0",
    newCostUlp: "0",
    oldRetailDsl: "0",
    oldRetailUlp: "0",
    newRetailDsl: "0",
    newRetailUlp: "0",
  },
});

const getErrorMessage = (errorLike, fallback) => {
  if (!errorLike) return fallback;
  if (typeof errorLike === "string") return errorLike;
  if (typeof errorLike.message === "string" && errorLike.message.trim()) return errorLike.message;
  if (typeof errorLike.details === "string" && errorLike.details.trim()) return errorLike.details;
  if (typeof errorLike.hint === "string" && errorLike.hint.trim()) return errorLike.hint;
  try {
    return JSON.stringify(errorLike);
  } catch {
    return fallback;
  }
};

function TankGauge({ label, value, capacity, highColor }) {
  const pct = Math.max(0, Math.min(100, Math.round((n(value) / Math.max(capacity, 1)) * 100)));
  const data = [{ value: pct }];
  const gaugeColor = pct < 20 ? "#dc2626" : pct <= 50 ? "#f59e0b" : highColor;
  const gaugeShellClass =
    pct < 20
      ? "rounded-2xl border border-red-300 bg-white p-4 shadow-sm animate-pulse"
      : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <div className={gaugeShellClass}>
      <div className="relative mx-auto h-[140px] w-[140px]">
        <RadialBarChart
          width={140}
          height={140}
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" fill={gaugeColor} cornerRadius={999} />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-2xl font-bold text-slate-900">{pct}%</span>
        </div>
      </div>
      <p className="mt-1 text-center text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-center text-xs text-slate-500">
        Cap: {capacity.toLocaleString("en-ZA")}L
      </p>
    </div>
  );
}

export default function FuelPlannerPage() {
  const searchParams = useSearchParams();
  const selectedStoreParam = searchParams.get("store");
  const selectedStore = STORE_OPTIONS.includes(selectedStoreParam ?? "")
    ? selectedStoreParam
    : "Hillcrest";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthKeyFor());
  const [plannerStateByStore, setPlannerStateByStore] = useState({});
  const plannerState = plannerStateByStore[selectedStore] ?? createDefaultPlannerState();
  const [pricingForm, setPricingForm] = useState(createDefaultPlannerState().pricing);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    deliveryDate: "",
    dslVolume: "",
    ulpVolume: "",
    orderReference: "",
    orderedBy: "",
    dslInvoice: "",
    ulpInvoice: "",
    notes: "",
    confirmed: "0",
  });
  const [plannerRows, setPlannerRows] = useState([]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState({
    atg: false,
    order: false,
    pricing: false,
  });
  const daysInCurrentMonth = monthDayCount(selectedMonth);
  const [selectedYear, selectedMonthNum] = selectedMonth.split("-").map(Number);
  const selectedMonthLabel = monthLabel(selectedMonth);
  const monthStartIso = `${selectedMonth}-01`;
  const monthEndIso = formatIsoDate(new Date(selectedYear, selectedMonthNum, 0));
  const monthDates = useMemo(
    () =>
      Array.from({ length: daysInCurrentMonth }, (_, i) =>
        formatIsoDate(new Date(selectedYear, selectedMonthNum - 1, i + 1))
      ),
    [selectedYear, selectedMonthNum, daysInCurrentMonth]
  );

  useEffect(() => {
    setPlannerStateByStore((prev) => {
      if (prev[selectedStore]) return prev;
      return { ...prev, [selectedStore]: createDefaultPlannerState() };
    });
  }, [selectedStore]);

  const updatePlannerState = (updater) => {
    setPlannerStateByStore((prev) => {
      const current = prev[selectedStore] ?? createDefaultPlannerState();
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedStore]: next };
    });
  };

  const fetchPlannerData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [atgRes, pricingRes, ordersRes, metricsRes] = await Promise.all([
      supabase
        .from("atg_readings")
        .select("*")
        .eq("store_name", selectedStore)
        .eq("month_year", selectedMonthLabel)
        .maybeSingle(),
      supabase
        .from("site_pricing")
        .select("*")
        .eq("store_name", selectedStore)
        .eq("month_year", selectedMonthLabel)
        .maybeSingle(),
      supabase
        .from("fuel_orders")
        .select("*")
        .eq("store_name", selectedStore)
        .gte("delivery_date", monthStartIso)
        .lte("delivery_date", monthEndIso)
        .order("delivery_date", { ascending: true }),
      supabase
        .from("daily_fuel_metrics")
        .select("*, ordered_by")
        .eq("store_name", selectedStore)
        .gte("reading_date", monthStartIso)
        .lte("reading_date", monthEndIso)
        .order("reading_date", { ascending: true }),
    ]);

    if (atgRes.error || pricingRes.error || ordersRes.error || metricsRes.error) {
      const message =
        atgRes.error?.message ||
        pricingRes.error?.message ||
        ordersRes.error?.message ||
        metricsRes.error?.message ||
        "Failed to load planner data";
      setError(message);
      setLoading(false);
      return;
    }

    const atgRow = atgRes.data;
    const pricingRow = pricingRes.data;
    const orderRows = ordersRes.data || [];
    const metricRows = metricsRes.data || [];
    const metricByDate = Object.fromEntries(
      metricRows.map((metric) => [metric.reading_date, metric])
    );

    const nextPricing = {
      oldCostDsl: String(n(pricingRow?.cost_dsl)),
      oldCostUlp: String(n(pricingRow?.cost_ulp)),
      newCostDsl: String(n(pricingRow?.cost_dsl)),
      newCostUlp: String(n(pricingRow?.cost_ulp)),
      oldRetailDsl: String(n(pricingRow?.retail_dsl)),
      oldRetailUlp: String(n(pricingRow?.retail_ulp)),
      newRetailDsl: String(n(pricingRow?.retail_dsl)),
      newRetailUlp: String(n(pricingRow?.retail_ulp)),
    };

    updatePlannerState((prev) => ({
      ...prev,
      atg: {
        dsl1: n(atgRow?.dsl_tank1),
        dsl2: n(atgRow?.dsl_tank2),
        ulp1: n(atgRow?.ulp_tank1),
        ulp2: n(atgRow?.ulp_tank2),
        dsl1ManualDip: n(atgRow?.manual_dip_dsl1),
        dsl2ManualDip: n(atgRow?.manual_dip_dsl2),
        ulp1ManualDip: n(atgRow?.manual_dip_ulp1),
        ulp2ManualDip: n(atgRow?.manual_dip_ulp2),
      },
      orders: orderRows.map((order) => ({
        id: order.id,
        deliveryDate: order.delivery_date,
        dslVolume: n(order.dsl_vol),
        ulpVolume: n(order.ulp_vol),
        orderReference: order.ref_no ?? "",
        orderedBy: order.ordered_by ?? "",
        dslInvoice: 0,
        ulpInvoice: 0,
        notes: "",
        confirmed: String(order.status).toLowerCase() === "confirmed",
      })),
      pricing: nextPricing,
    }));
    setPricingForm(nextPricing);

    setPlannerRows(
      monthDates.map((isoDate) => ({
        date: isoDate,
        forecast_dsl: litersToKlInput(
          readMetricField(metricByDate[isoDate], [
            "forecast_dsl",
            "dsl_forecast",
            "forecast_sales_dsl",
          ])
        ),
        forecast_ulp: litersToKlInput(
          readMetricField(metricByDate[isoDate], [
            "forecast_ulp",
            "ulp_forecast",
            "forecast_sales_ulp",
          ])
        ),
        actual_dsl: litersToKlInput(
          readMetricField(metricByDate[isoDate], [
            "actual_dsl",
            "dsl_actual",
            "actual_sales_dsl",
          ])
        ),
        actual_ulp: litersToKlInput(
          readMetricField(metricByDate[isoDate], [
            "actual_ulp",
            "ulp_actual",
            "actual_sales_ulp",
            "actual_petrol",
            "actual_ulp_liters",
          ])
        ),
        ordered_by: String(
          readMetricField(metricByDate[isoDate], ["ordered_by", "orderedBy"]) || ""
        ),
      }))
    );

    setLoading(false);
  }, [monthDates, monthEndIso, monthStartIso, selectedMonthLabel, selectedStore]);

  useEffect(() => {
    fetchPlannerData();
  }, [selectedStore, selectedMonth, fetchPlannerData]);

  const tankCapacity = 30000;
  const tanks = useMemo(
    () => [
      { label: "DSL Tank 1", value: plannerState.atg.dsl1, highColor: "#185FA5" },
      { label: "DSL Tank 2", value: plannerState.atg.dsl2, highColor: "#185FA5" },
      { label: "ULP Tank 1", value: plannerState.atg.ulp1, highColor: "#16a34a" },
      { label: "ULP Tank 2", value: plannerState.atg.ulp2, highColor: "#16a34a" },
    ],
    [plannerState.atg]
  );

  const handleAtgInput = (key, value) => {
    updatePlannerState((prev) => ({
      ...prev,
      atg: { ...prev.atg, [key]: n(value) },
    }));
  };

  const saveAtgReadings = async () => {
    setSaving((prev) => ({ ...prev, atg: true }));
    const payload = {
      store_name: selectedStore,
      month_year: selectedMonthLabel,
      dsl_tank1: n(plannerState.atg.dsl1),
      dsl_tank2: n(plannerState.atg.dsl2),
      ulp_tank1: n(plannerState.atg.ulp1),
      ulp_tank2: n(plannerState.atg.ulp2),
      manual_dip_dsl1: n(plannerState.atg.dsl1ManualDip),
      manual_dip_dsl2: n(plannerState.atg.dsl2ManualDip),
      manual_dip_ulp1: n(plannerState.atg.ulp1ManualDip),
      manual_dip_ulp2: n(plannerState.atg.ulp2ManualDip),
    };
    let saveError = null;
    const { error: upsertError } = await supabase
      .from("atg_readings")
      .upsert(payload, { onConflict: "store_name,month_year" });

    if (upsertError) {
      // Fallback when onConflict target has no matching unique constraint in DB.
      const { data: existing, error: lookupError } = await supabase
        .from("atg_readings")
        .select("id")
        .eq("store_name", selectedStore)
        .eq("month_year", selectedMonthLabel)
        .maybeSingle();

      if (lookupError) {
        saveError = lookupError;
      } else if (existing?.id) {
        const { error: updateError } = await supabase
          .from("atg_readings")
          .update(payload)
          .eq("id", existing.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await supabase.from("atg_readings").insert(payload);
        saveError = insertError;
      }
    }

    if (upsertError || saveError) {
      const finalError = saveError || upsertError;
      const errorMessage = getErrorMessage(finalError, "Unknown error while saving ATG readings.");
      console.error("ATG save error (raw):", finalError);
      alert(`Failed to save ATG readings: ${errorMessage}`);
      setToast({ type: "error", message: errorMessage });
      setSaving((prev) => ({ ...prev, atg: false }));
      return;
    }
    console.log("ATG save success:", payload);
    setToast({ type: "success", message: "ATG readings saved." });
    await fetchPlannerData();
    setSaving((prev) => ({ ...prev, atg: false }));
  };

  const orderByDate = useMemo(() => {
    const mapped = {};
    plannerState.orders.forEach((order) => {
      mapped[order.deliveryDate] = order;
    });
    return mapped;
  }, [plannerState.orders]);

  const handleOrderInput = (key, value) => {
    setOrderForm((prev) => ({ ...prev, [key]: value }));
  };

  const openNewOrderModal = () => {
    setOrderForm({
      deliveryDate: monthDates[0] ?? "",
      dslVolume: "",
      ulpVolume: "",
      orderReference: "",
      orderedBy: "",
      dslInvoice: "",
      ulpInvoice: "",
      notes: "",
      confirmed: "0",
    });
    setIsOrderModalOpen(true);
  };

  const saveOrder = async () => {
    if (!orderForm.deliveryDate || !orderForm.orderReference.trim()) return;
    setSaving((prev) => ({ ...prev, order: true }));

    const newOrder = {
      id: `${orderForm.deliveryDate}-${Date.now()}`,
      deliveryDate: orderForm.deliveryDate,
      dslVolume: n(orderForm.dslVolume),
      ulpVolume: n(orderForm.ulpVolume),
      orderReference: orderForm.orderReference.trim(),
      orderedBy: orderForm.orderedBy.trim(),
      dslInvoice: n(orderForm.dslInvoice),
      ulpInvoice: n(orderForm.ulpInvoice),
      notes: orderForm.notes.trim(),
      confirmed: orderForm.confirmed === "1",
    };

    const payload = {
      store_name: selectedStore,
      delivery_date: newOrder.deliveryDate,
      dsl_vol: newOrder.dslVolume,
      ulp_vol: newOrder.ulpVolume,
      ref_no: newOrder.orderReference,
      ordered_by: newOrder.orderedBy,
      status: newOrder.confirmed ? "confirmed" : "pending",
    };

    const { data, error: insertError } = await supabase
      .from("fuel_orders")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (insertError) {
      console.error("Order save error:", insertError);
      alert(`Failed to save order: ${insertError.message}`);
      setToast({ type: "error", message: insertError.message });
      setSaving((prev) => ({ ...prev, order: false }));
      return;
    }
    console.log("Order save success:", payload);

    updatePlannerState((prev) => ({
      ...prev,
      orders: [...prev.orders, { ...newOrder, id: data?.id ?? newOrder.id }].sort(
        (a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()
      ),
    }));
    setIsOrderModalOpen(false);
    setToast({ type: "success", message: "Order saved." });
    await fetchPlannerData();
    setSaving((prev) => ({ ...prev, order: false }));
  };

  const updatePricingForm = (key, value) => {
    setPricingForm((prev) => ({ ...prev, [key]: value }));
  };

  const margin = (retail, cost) => {
    const r = n(retail);
    const c = n(cost);
    return (r - c).toFixed(2);
  };

  const savePricing = async () => {
    setSaving((prev) => ({ ...prev, pricing: true }));
    const mergedCostDsl = n(pricingForm.newCostDsl || pricingForm.oldCostDsl);
    const mergedCostUlp = n(pricingForm.newCostUlp || pricingForm.oldCostUlp);
    const mergedRetailDsl = n(pricingForm.newRetailDsl || pricingForm.oldRetailDsl);
    const mergedRetailUlp = n(pricingForm.newRetailUlp || pricingForm.oldRetailUlp);
    const payload = {
      store_name: selectedStore,
      month_year: selectedMonthLabel,
      cost_dsl: mergedCostDsl,
      cost_ulp: mergedCostUlp,
      retail_dsl: mergedRetailDsl,
      retail_ulp: mergedRetailUlp,
    };
    let saveError = null;
    const { error: upsertError } = await supabase
      .from("site_pricing")
      .upsert(payload, { onConflict: "store_name,month_year" });

    if (upsertError) {
      const { data: existing, error: lookupError } = await supabase
        .from("site_pricing")
        .select("id")
        .eq("store_name", selectedStore)
        .eq("month_year", selectedMonthLabel)
        .maybeSingle();

      if (lookupError) {
        saveError = lookupError;
      } else if (existing?.id) {
        const { error: updateError } = await supabase
          .from("site_pricing")
          .update(payload)
          .eq("id", existing.id);
        saveError = updateError;
      } else {
        const { error: insertError } = await supabase.from("site_pricing").insert(payload);
        saveError = insertError;
      }
    }

    if (upsertError || saveError) {
      const finalError = saveError || upsertError;
      const errorMessage = getErrorMessage(finalError, "Unknown error while saving pricing.");
      console.error("Pricing save error (raw):", finalError);
      alert(`Failed to save pricing: ${errorMessage}`);
      setToast({ type: "error", message: errorMessage });
      setSaving((prev) => ({ ...prev, pricing: false }));
      return;
    }
    console.log("Pricing save success:", payload);
    updatePlannerState((prev) => ({
      ...prev,
      pricing: {
        oldCostDsl: String(mergedCostDsl),
        oldCostUlp: String(mergedCostUlp),
        newCostDsl: String(mergedCostDsl),
        newCostUlp: String(mergedCostUlp),
        oldRetailDsl: String(mergedRetailDsl),
        oldRetailUlp: String(mergedRetailUlp),
        newRetailDsl: String(mergedRetailDsl),
        newRetailUlp: String(mergedRetailUlp),
      },
    }));
    setToast({ type: "success", message: "Pricing saved." });
    await fetchPlannerData();
    setSaving((prev) => ({ ...prev, pricing: false }));
  };

  const monthlyTotals = useMemo(() => {
    return plannerRows.reduce(
      (acc, row) => {
        acc.dsl += klInputToLiters(row.actual_dsl);
        acc.ulp += klInputToLiters(row.actual_ulp);
        return acc;
      },
      { dsl: 0, ulp: 0 }
    );
  }, [plannerRows]);
  const effectiveDslMargin = useMemo(() => {
    const retail = n(pricingForm.newRetailDsl || pricingForm.oldRetailDsl);
    const cost = n(pricingForm.newCostDsl || pricingForm.oldCostDsl);
    return retail - cost;
  }, [pricingForm]);
  const effectiveUlpMargin = useMemo(() => {
    const retail = n(pricingForm.newRetailUlp || pricingForm.oldRetailUlp);
    const cost = n(pricingForm.newCostUlp || pricingForm.oldCostUlp);
    return retail - cost;
  }, [pricingForm]);
  const monthlyGrossProfit = useMemo(() => {
    return monthlyTotals.dsl * effectiveDslMargin + monthlyTotals.ulp * effectiveUlpMargin;
  }, [monthlyTotals, effectiveDslMargin, effectiveUlpMargin]);
  const dailyVarianceByDate = useMemo(() => {
    const mapped = {};
    plannerRows.forEach((row) => {
      const forecastTotalL =
        klInputToLiters(row.forecast_dsl) + klInputToLiters(row.forecast_ulp);
      const actualTotalL = klInputToLiters(row.actual_dsl) + klInputToLiters(row.actual_ulp);
      mapped[row.date] = forecastTotalL - actualTotalL;
    });
    return mapped;
  }, [plannerRows]);
  const stockProjectionData = useMemo(() => {
    const initialDslStock = n(plannerState.atg.dsl1) + n(plannerState.atg.dsl2);
    const initialUlpStock = n(plannerState.atg.ulp1) + n(plannerState.atg.ulp2);
    let dslRunning = initialDslStock;
    let ulpRunning = initialUlpStock;

    return plannerRows.map((row) => {
      const order = orderByDate[row.date];
      if (order?.confirmed) {
        dslRunning += n(order.dslVolume);
        ulpRunning += n(order.ulpVolume);
      }
      dslRunning -= klInputToLiters(row.actual_dsl);
      ulpRunning -= klInputToLiters(row.actual_ulp);

      return {
        day: new Date(row.date).getDate(),
        dsl: Math.max(0, dslRunning),
        ulp: Math.max(0, ulpRunning),
      };
    });
  }, [plannerRows, plannerState.atg, orderByDate]);
  const hasCriticalBreach = useMemo(
    () => stockProjectionData.some((p) => p.dsl < 5000 || p.ulp < 5000),
    [stockProjectionData]
  );
  const wetVarianceByTank = useMemo(
    () => ({
      dsl1: n(plannerState.atg.dsl1) - n(plannerState.atg.dsl1ManualDip),
      dsl2: n(plannerState.atg.dsl2) - n(plannerState.atg.dsl2ManualDip),
      ulp1: n(plannerState.atg.ulp1) - n(plannerState.atg.ulp1ManualDip),
      ulp2: n(plannerState.atg.ulp2) - n(plannerState.atg.ulp2ManualDip),
    }),
    [plannerState.atg]
  );
  const totalMonthlyWetStockVariance = useMemo(
    () =>
      wetVarianceByTank.dsl1 +
      wetVarianceByTank.dsl2 +
      wetVarianceByTank.ulp1 +
      wetVarianceByTank.ulp2,
    [wetVarianceByTank]
  );

  const updatePlannerCell = (date, field, value) => {
    setPlannerRows((prev) =>
      prev.map((row) => (row.date === date ? { ...row, [field]: value } : row))
    );
  };

  const savePlannerMetricRow = async (date) => {
    const row = plannerRows.find((entry) => entry.date === date);
    if (!row) return;

    const { data: existingMetricRow } = await supabase
      .from("daily_fuel_metrics")
      .select("*, ordered_by")
      .eq("store_name", selectedStore)
      .eq("reading_date", date)
      .maybeSingle();

    const payloadVariants = buildDailyMetricPayloadVariants(
      selectedStore,
      date,
      row,
      existingMetricRow
    );
    let finalError = null;
    let saved = false;

    for (const payload of payloadVariants) {
      let saveError = null;
      let savedData = null;
      const { data: upsertData, error: upsertError } = await supabase
        .from("daily_fuel_metrics")
        .upsert(payload, { onConflict: "store_name,reading_date" })
        .select("id, reading_date, ordered_by")
        .maybeSingle();

      if (upsertError) {
        const { data: existing, error: lookupError } = await supabase
          .from("daily_fuel_metrics")
          .select("id, ordered_by")
          .eq("store_name", selectedStore)
          .eq("reading_date", date)
          .maybeSingle();

        if (lookupError) {
          saveError = lookupError;
        } else if (existing?.id) {
          const { data: updateData, error: updateError } = await supabase
            .from("daily_fuel_metrics")
            .update(payload)
            .eq("id", existing.id)
            .select("id, reading_date, ordered_by")
            .maybeSingle();
          savedData = updateData;
          saveError = updateError;
        } else {
          const { data: insertData, error: insertError } = await supabase
            .from("daily_fuel_metrics")
            .insert(payload)
            .select("id, reading_date, ordered_by")
            .maybeSingle();
          savedData = insertData;
          saveError = insertError;
        }
      } else {
        savedData = upsertData;
      }

      if (!upsertError && !saveError) {
        console.log("Saved data:", savedData || payload);
        saved = true;
        break;
      }

      console.error("Save error:", saveError || upsertError);
      finalError = saveError || upsertError;
    }

    if (!saved && finalError) {
      console.error("Save error:", finalError);
      const errorMessage = getErrorMessage(
        finalError,
        "Unknown error while saving daily fuel metrics."
      );
      console.error("Daily fuel metrics save error (raw):", finalError);
      alert(`Failed to save daily fuel metrics: ${errorMessage}`);
      setToast({ type: "error", message: errorMessage });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  if (loading)
    return (
      <div className="grid min-h-[50vh] place-items-center p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#ff6e00]" />
          Loading...
        </div>
      </div>
    );
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              F.Planner V1 — {selectedStore}
            </h2>
            <p className="text-xs text-slate-500">
              Account: 0322605 | Astron: 0860 300 860 | Unitrans: 0810 314 215
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#ff6e00]"
            >
              {Array.from({ length: 18 }, (_, idx) => {
                const today = new Date();
                const base = new Date(today.getFullYear(), today.getMonth() - 6 + idx, 1);
                const key = monthKeyFor(base);
                return (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={() =>
                generateMonthlyAuditPdf({
                  storeName: selectedStore,
                  periodLabel: selectedMonthLabel,
                  monthKeyForFilename: selectedMonth,
                  monthlyTotals,
                  monthlyGrossProfit,
                  plannerState,
                  plannerRows,
                  orderByDate,
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Download Monthly Audit
            </button>
            <button
              type="button"
              onClick={openNewOrderModal}
              className="rounded-lg bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              + New Order
            </button>
          </div>
        </div>
      </div>
      <Tabs.Root defaultValue="monthly" className="space-y-5">
        <Tabs.List className="inline-flex w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <Tabs.Trigger
            value="monthly"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Monthly Planner
          </Tabs.Trigger>
          <Tabs.Trigger
            value="atg"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            ATG Underground Stock
          </Tabs.Trigger>
          <Tabs.Trigger
            value="orders"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Orders
          </Tabs.Trigger>
          <Tabs.Trigger
            value="pricing"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Pricing
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="monthly" className="space-y-5">
          <div className="flex gap-4 overflow-x-auto pb-1">
            {tanks.map((tank) => (
              <div key={tank.label} className="min-w-[220px] flex-1">
                <TankGauge
                  label={tank.label}
                  value={tank.value}
                  capacity={tankCapacity}
                  highColor={tank.highColor}
                />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Monthly Planner</h4>
                <p className="text-xs text-slate-500">
                  Estimated Gross Profit: R {monthlyGrossProfit.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <button
                type="button"
                onClick={openNewOrderModal}
                className="rounded-lg bg-[#ff6e00] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
              >
                New Order
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th rowSpan={2} className="sticky top-0 bg-slate-50 px-3 py-2 text-left font-semibold">Day</th>
                  <th colSpan={2} className="sticky top-0 bg-slate-50 px-3 py-2 text-center font-semibold">
                    Forecast <span className="ml-1 text-[10px] font-medium text-slate-400">kL</span>
                  </th>
                  <th colSpan={2} className="sticky top-0 bg-slate-50 px-3 py-2 text-center font-semibold">
                    Actual Sales <span className="ml-1 text-[10px] font-medium text-slate-400">kL</span>
                  </th>
                  <th rowSpan={2} className="sticky top-0 bg-slate-50 px-3 py-2 text-left font-semibold">Daily Variance (L)</th>
                  <th colSpan={4} className="sticky top-0 bg-slate-50 px-3 py-2 text-center font-semibold">Orders</th>
                  <th rowSpan={2} className="sticky top-0 bg-slate-50 px-3 py-2 text-left font-semibold">Ordered by</th>
                </tr>
                <tr>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">DSL</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">ULP</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">DSL</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">ULP</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">DSL vol (L)</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">ULP vol (L)</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">Ref no.</th>
                  <th className="sticky top-[32px] bg-slate-50 px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {plannerRows.map((row) => (
                  <tr
                    key={row.date}
                    className={`border-t border-slate-100 ${
                      orderByDate[row.date]?.confirmed
                        ? "bg-emerald-50/70"
                        : new Date(row.date).getDate() % 2 === 0
                        ? "bg-slate-50/40"
                        : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-700">{formatDay(row.date)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.forecast_dsl}
                        onChange={(e) =>
                          updatePlannerCell(row.date, "forecast_dsl", e.target.value)
                        }
                        onKeyDown={commitPlannerInputOnEnter}
                        onBlur={() => savePlannerMetricRow(row.date)}
                        className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-slate-900 outline-none focus:border-[#ff6e00]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.forecast_ulp}
                        onChange={(e) =>
                          updatePlannerCell(row.date, "forecast_ulp", e.target.value)
                        }
                        onKeyDown={commitPlannerInputOnEnter}
                        onBlur={() => savePlannerMetricRow(row.date)}
                        className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-slate-900 outline-none focus:border-[#ff6e00]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.actual_dsl}
                        onChange={(e) => updatePlannerCell(row.date, "actual_dsl", e.target.value)}
                        onKeyDown={commitPlannerInputOnEnter}
                        onBlur={() => savePlannerMetricRow(row.date)}
                        className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-slate-900 outline-none focus:border-[#ff6e00]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.actual_ulp}
                        onChange={(e) => updatePlannerCell(row.date, "actual_ulp", e.target.value)}
                        onKeyDown={commitPlannerInputOnEnter}
                        onBlur={() => savePlannerMetricRow(row.date)}
                        className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-slate-900 outline-none focus:border-[#ff6e00]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          dailyVarianceByDate[row.date] < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {dailyVarianceByDate[row.date].toLocaleString("en-ZA")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#185FA5]">
                      {orderByDate[row.date]?.dslVolume
                        ? orderByDate[row.date].dslVolume.toLocaleString("en-ZA")
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-[#3B6D11]">
                      {orderByDate[row.date]?.ulpVolume
                        ? orderByDate[row.date].ulpVolume.toLocaleString("en-ZA")
                        : ""}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#854F0B]">
                      {orderByDate[row.date]?.orderReference ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      {orderByDate[row.date] ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {orderByDate[row.date].confirmed ? "Confirmed" : "Ordered"}
                        </span>
                      ) : (
                        <span />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.ordered_by || ""}
                        onChange={(e) => updatePlannerCell(row.date, "ordered_by", e.target.value)}
                        onKeyDown={commitPlannerInputOnEnter}
                        onBlur={() => savePlannerMetricRow(row.date)}
                        className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-[#ff6e00]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/70 text-[11px] font-semibold text-slate-700">
                <tr>
                  <td className="px-3 py-2">Total Sales (L)</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">{monthlyTotals.dsl.toLocaleString("en-ZA")}</td>
                  <td className="px-3 py-2">{monthlyTotals.ulp.toLocaleString("en-ZA")}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Stock Level Projection</h4>
              <p className="text-xs text-slate-500">
                Projection uses Actual Sales and confirmed order delivery jumps.
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stockProjectionData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="dslAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={EXECUTIVE_NAVY} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={EXECUTIVE_NAVY} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="ulpAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={EXECUTIVE_FOREST} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={EXECUTIVE_FOREST} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fontFamily: "Inter, Segoe UI, sans-serif", fill: "#334155" }}
                    tickFormatter={(value, index) => (index % 2 === 0 ? value : "")}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "Day of Month",
                      position: "insideBottom",
                      dy: 8,
                      style: { fontSize: 11, fontFamily: "Inter, Segoe UI, sans-serif", fill: "#475569" },
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontFamily: "Inter, Segoe UI, sans-serif", fill: "#334155" }}
                    label={{
                      value: "Volume (Liters)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11, fontFamily: "Inter, Segoe UI, sans-serif", fill: "#475569" },
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<StockProjectionTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", fontFamily: "Inter, Segoe UI, sans-serif" }}
                  />
                  {hasCriticalBreach && (
                    <ReferenceArea y1={0} y2={5000} fill="rgba(239, 68, 68, 0.05)" />
                  )}
                  <ReferenceLine
                    y={5000}
                    stroke="#ef4444"
                    strokeDasharray="6 6"
                    strokeWidth={0.8}
                    label={{ value: "Critical Level (5,000L)", fill: "#ef4444", fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="dsl"
                    fill="url(#dslAreaGradient)"
                    fillOpacity={1}
                    strokeOpacity={0}
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="ulp"
                    fill="url(#ulpAreaGradient)"
                    fillOpacity={1}
                    strokeOpacity={0}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="dsl"
                    name="Diesel (DSL)"
                    stroke={EXECUTIVE_NAVY}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ulp"
                    name="Petrol (ULP)"
                    stroke={EXECUTIVE_FOREST}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="atg">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">ATG Underground Stock</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Capture paired system and physical dip readings for each tank.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="hidden grid-cols-[120px_1fr_1fr] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
                  <span>Tank</span>
                  <span>System Reading (ATG)</span>
                  <span>Physical Dip Reading</span>
                </div>

                {[
                  { label: "DSL Tank 1", valueKey: "dsl1", dipKey: "dsl1ManualDip", variance: wetVarianceByTank.dsl1 },
                  { label: "DSL Tank 2", valueKey: "dsl2", dipKey: "dsl2ManualDip", variance: wetVarianceByTank.dsl2 },
                  { label: "ULP Tank 1", valueKey: "ulp1", dipKey: "ulp1ManualDip", variance: wetVarianceByTank.ulp1 },
                  { label: "ULP Tank 2", valueKey: "ulp2", dipKey: "ulp2ManualDip", variance: wetVarianceByTank.ulp2 },
                ].map((tank) => (
                  <div
                    key={tank.label}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[120px_1fr_1fr]"
                  >
                    <div className="flex items-center">
                      <p className="text-sm font-semibold text-slate-800">{tank.label}</p>
                    </div>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-slate-500 md:hidden">
                        System Reading (ATG)
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="System Reading (ATG)"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                        value={plannerState.atg[tank.valueKey]}
                        onChange={(e) => handleAtgInput(tank.valueKey, e.target.value)}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-slate-500 md:hidden">
                        Physical Dip Reading
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Physical Dip Reading"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                        value={plannerState.atg[tank.dipKey]}
                        onChange={(e) => handleAtgInput(tank.dipKey, e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={saveAtgReadings}
                  disabled={saving.atg}
                  className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving.atg ? "Saving..." : "Save ATG Readings"}
                </button>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Insights
                </p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    Math.abs(totalMonthlyWetStockVariance) > 50 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {totalMonthlyWetStockVariance.toLocaleString("en-ZA")} L
                </p>
                <p className="mt-1 text-sm text-slate-500">Total wet stock variance this month</p>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { label: "DSL Tank 1", variance: wetVarianceByTank.dsl1 },
                  { label: "DSL Tank 2", variance: wetVarianceByTank.dsl2 },
                  { label: "ULP Tank 1", variance: wetVarianceByTank.ulp1 },
                  { label: "ULP Tank 2", variance: wetVarianceByTank.ulp2 },
                ].map((tank) => (
                  <div
                    key={tank.label}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">{tank.label}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        Math.abs(tank.variance) > 50
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {tank.variance.toLocaleString("en-ZA")} L
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Tabs.Content>

        <Tabs.Content value="orders">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Orders</h3>
              <button
                type="button"
                onClick={openNewOrderModal}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Place New Order
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Delivery Day</th>
                    <th className="px-4 py-3 text-left font-semibold">DSL Volume (L)</th>
                    <th className="px-4 py-3 text-left font-semibold">ULP Volume (L)</th>
                    <th className="px-4 py-3 text-left font-semibold">Order Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {plannerState.orders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-slate-500" colSpan={4}>
                        No orders saved yet.
                      </td>
                    </tr>
                  ) : (
                    plannerState.orders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-medium text-slate-700">
                          {formatDay(order.deliveryDate)}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {order.dslVolume.toLocaleString("en-ZA")}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {order.ulpVolume.toLocaleString("en-ZA")}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {order.orderReference}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="pricing">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Pricing & Margins</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Cost Price (R/L)</h4>
                <div className="space-y-2">
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Old DSL" value={pricingForm.oldCostDsl} onChange={(e) => updatePricingForm("oldCostDsl", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Old ULP" value={pricingForm.oldCostUlp} onChange={(e) => updatePricingForm("oldCostUlp", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="New DSL" value={pricingForm.newCostDsl} onChange={(e) => updatePricingForm("newCostDsl", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="New ULP" value={pricingForm.newCostUlp} onChange={(e) => updatePricingForm("newCostUlp", e.target.value)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Retail Price (R/L)</h4>
                <div className="space-y-2">
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Old DSL" value={pricingForm.oldRetailDsl} onChange={(e) => updatePricingForm("oldRetailDsl", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Old ULP" value={pricingForm.oldRetailUlp} onChange={(e) => updatePricingForm("oldRetailUlp", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="New DSL" value={pricingForm.newRetailDsl} onChange={(e) => updatePricingForm("newRetailDsl", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="New ULP" value={pricingForm.newRetailUlp} onChange={(e) => updatePricingForm("newRetailUlp", e.target.value)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Margin (R/L)</h4>
                <div className="space-y-2 text-sm">
                  <p>Old DSL: <span className="font-semibold">{margin(pricingForm.oldRetailDsl, pricingForm.oldCostDsl)}</span></p>
                  <p>Old ULP: <span className="font-semibold">{margin(pricingForm.oldRetailUlp, pricingForm.oldCostUlp)}</span></p>
                  <p>New DSL: <span className="font-semibold">{margin(pricingForm.newRetailDsl, pricingForm.newCostDsl)}</span></p>
                  <p>New ULP: <span className="font-semibold">{margin(pricingForm.newRetailUlp, pricingForm.newCostUlp)}</span></p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={savePricing}
              disabled={saving.pricing}
              className="mt-4 rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving.pricing ? "Saving..." : "Save Pricing"}
            </button>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Place New Order</h4>

            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Delivery Day</span>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                    value={orderForm.deliveryDate}
                    onChange={(e) => handleOrderInput("deliveryDate", e.target.value)}
                  >
                    <option value="">Select day</option>
                    {monthDates.map((isoDate) => (
                      <option key={isoDate} value={isoDate}>
                        {formatDay(isoDate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Order Ref No</span>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.orderReference} onChange={(e) => handleOrderInput("orderReference", e.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Ordered By</span>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.orderedBy} onChange={(e) => handleOrderInput("orderedBy", e.target.value)} />
                </label>
              </div>

              <div className="rounded-xl border border-blue-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#185FA5]">Diesel (DSL)</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm text-slate-700">Volume Ordered (L)</span>
                    <input type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.dslVolume} onChange={(e) => handleOrderInput("dslVolume", e.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-slate-700">Invoice Value (Post-delivery)</span>
                    <input type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.dslInvoice} onChange={(e) => handleOrderInput("dslInvoice", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-green-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#3B6D11]">Petrol (ULP)</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm text-slate-700">Volume Ordered (L)</span>
                    <input type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.ulpVolume} onChange={(e) => handleOrderInput("ulpVolume", e.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-slate-700">Invoice Value (Post-delivery)</span>
                    <input type="number" min="0" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.ulpInvoice} onChange={(e) => handleOrderInput("ulpInvoice", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Notes / Adjustments</span>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.notes} onChange={(e) => handleOrderInput("notes", e.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Confirmed?</span>
                  <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={orderForm.confirmed} onChange={(e) => handleOrderInput("confirmed", e.target.value)}>
                    <option value="0">No — Pending</option>
                    <option value="1">Yes</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving.order}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving.order ? "Saving..." : "Save Order"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[60]">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}