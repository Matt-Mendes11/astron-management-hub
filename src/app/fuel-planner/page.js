"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter, useSearchParams } from "next/navigation";
import AppDrillBack from "../../components/drilldown/AppDrillBack";
import { labelToSlug } from "../../lib/stores";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
export const dynamic = 'force-dynamic';
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const n = (v) => Number(v ?? 0);

/** Strip invalid chars; allow one decimal point for currency/litre entry. */
const sanitizeDecimalInput = (raw) => {
  if (raw == null) return "";
  let s = String(raw).replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot === -1) return s;
  return s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
};

const formatDay = (dateValue) => {
  if (!dateValue) return "-";
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return String(dateValue);
  return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
};

/** Day column: calendar date only (e.g. 01 Apr), local calendar parts (no UTC shift). */
const formatPlannerDayCell = (isoDate) => {
  if (!isoDate) return "—";
  const parts = String(isoDate).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return formatDay(isoDate);
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleDateString("en-ZA", { month: "short" });
  return `${day} ${mon}`;
};

/** Day + weekday for planner (calendar-correct for YYYY-MM-DD). */
const formatPlannerDayWithWeekday = (isoDate) => {
  if (!isoDate) return "—";
  const parts = String(isoDate).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return String(isoDate);
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleDateString("en-ZA", { month: "short" });
  const dow = dt.toLocaleDateString("en-ZA", { weekday: "short" });
  return `${day} ${mon} · ${dow}`;
};

const formatLitresDisplay = (litres) =>
  `${Math.round(n(litres)).toLocaleString("en-ZA")}L`;
const formatIsoDate = (dateValue) => {
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Map Supabase date / timestamptz values to YYYY-MM-DD keys (matches planner row `date`). */
const normalizeDateKey = (value) => {
  if (value == null || value === "") return "";
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return formatIsoDate(dt);
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

/** Passcode for unlocking tank capacity editing (unlock modal). Replace with env later if needed. */
const TANK_CAPACITY_UNLOCK_CODE = "1234";

const DEFAULT_TANK_CAPACITY_L = 30000;

const BRAND_PURPLE = [60, 0, 139];
const BRAND_ORANGE = [255, 110, 0];
const KL_TO_LITERS = 1000;
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

function generateMonthlyAuditPdf({
  storeName,
  periodLabel,
  monthKeyForFilename,
  plannerState,
  plannerRows,
  orderByDate,
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const totalOrderedDsl = plannerState.orders.reduce((s, o) => s + n(o.dslVolume), 0);
  const totalOrderedUlp = plannerState.orders.reduce((s, o) => s + n(o.ulpVolume), 0);
  const totalOrderedL = totalOrderedDsl + totalOrderedUlp;

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
    `Total DSL ordered (month): ${totalOrderedDsl.toLocaleString("en-ZA")} L`,
    margin,
    y
  );
  y += 5;
  doc.text(
    `Total ULP ordered (month): ${totalOrderedUlp.toLocaleString("en-ZA")} L`,
    margin,
    y
  );
  y += 5;
  doc.text(`Combined orders (month): ${totalOrderedL.toLocaleString("en-ZA")} L`, margin, y);
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
      formatPlannerDayWithWeekday(row.date),
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
      (() => {
        const fromOrder = od?.orderedBy != null ? String(od.orderedBy).trim() : "";
        const fromRow = row.ordered_by != null ? String(row.ordered_by).trim() : "";
        const v = fromOrder || fromRow;
        return v ? v : "—";
      })(),
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
  },
  tankCapacities: {
    dsl1: DEFAULT_TANK_CAPACITY_L,
    dsl2: DEFAULT_TANK_CAPACITY_L,
    ulp1: DEFAULT_TANK_CAPACITY_L,
    ulp2: DEFAULT_TANK_CAPACITY_L,
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

const normalizeTankCapacities = (partial) => ({
  dsl1: Math.max(1, Math.round(n(partial?.dsl1 ?? DEFAULT_TANK_CAPACITY_L))),
  dsl2: Math.max(1, Math.round(n(partial?.dsl2 ?? DEFAULT_TANK_CAPACITY_L))),
  ulp1: Math.max(1, Math.round(n(partial?.ulp1 ?? DEFAULT_TANK_CAPACITY_L))),
  ulp2: Math.max(1, Math.round(n(partial?.ulp2 ?? DEFAULT_TANK_CAPACITY_L))),
});

const buildAtgReadingsPayload = (storeName, monthYearLabel, state) => {
  const caps = normalizeTankCapacities(state.tankCapacities ?? {});
  return {
    store_name: storeName,
    month_year: monthYearLabel,
    dsl_tank1: n(state.atg.dsl1),
    dsl_tank2: n(state.atg.dsl2),
    ulp_tank1: n(state.atg.ulp1),
    ulp_tank2: n(state.atg.ulp2),
    manual_dip_dsl1: 0,
    manual_dip_dsl2: 0,
    manual_dip_ulp1: 0,
    manual_dip_ulp2: 0,
    tank_capacity_dsl1: caps.dsl1,
    tank_capacity_dsl2: caps.dsl2,
    tank_capacity_ulp1: caps.ulp1,
    tank_capacity_ulp2: caps.ulp2,
  };
};

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

function TankGauge({ label, value, capacity, highColor, compact = false }) {
  const pct = Math.max(0, Math.min(100, Math.round((n(value) / Math.max(capacity, 1)) * 100)));
  const data = [{ value: pct }];
  const gaugeColor = pct < 20 ? "#dc2626" : pct <= 50 ? "#f59e0b" : highColor;
  const gaugeShellClass =
    pct < 20
      ? `rounded-xl border border-red-300 bg-white shadow-sm ${compact ? "p-3.5" : "p-4"} animate-pulse`
      : `rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? "p-3.5" : "p-4"}`;
  const size = compact ? 132 : 140;
  const litres = formatLitresDisplay(n(value));

  return (
    <div className={gaugeShellClass}>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <RadialBarChart
          width={size}
          height={size}
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={compact ? 10 : 10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" fill={gaugeColor} cornerRadius={999} />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          <span className={`font-bold tabular-nums leading-none text-slate-900 ${compact ? "text-[15px]" : "text-base"}`}>
            {litres}
          </span>
          <span className={`font-semibold tabular-nums text-slate-500 ${compact ? "text-[13px]" : "text-sm"}`}>
            {pct}%
          </span>
        </div>
      </div>
      <p className={`mt-2 text-center font-semibold text-slate-700 ${compact ? "text-xs" : "text-sm"}`}>{label}</p>
      <p className="text-center text-[10px] text-slate-500">Cap {capacity.toLocaleString("en-ZA")}L</p>
    </div>
  );
}

function FuelPlannerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("return");
  const selectedStoreParam = searchParams.get("store");
  const selectedStore = STORE_OPTIONS.includes(selectedStoreParam ?? "")
    ? selectedStoreParam
    : "Hillcrest";

  useEffect(() => {
    if (returnUrl) return;
    const slug = labelToSlug(selectedStore);
    router.replace(`/${slug}/fuel-management`);
  }, [returnUrl, router, selectedStore]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthKeyFor());
  const [plannerStateByStore, setPlannerStateByStore] = useState({});
  const plannerState = plannerStateByStore[selectedStore] ?? createDefaultPlannerState();
  const [pricingForm, setPricingForm] = useState(createDefaultPlannerState().pricing);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCriticalSettingsOpen, setIsCriticalSettingsOpen] = useState(false);
  const [criticalSettingsUnlocked, setCriticalSettingsUnlocked] = useState(false);
  const [capacityUnlockOpen, setCapacityUnlockOpen] = useState(false);
  const [capacityUnlockPasscode, setCapacityUnlockPasscode] = useState("");
  const [capacityUnlockError, setCapacityUnlockError] = useState("");
  const [capacityDraft, setCapacityDraft] = useState({
    dsl1: String(DEFAULT_TANK_CAPACITY_L),
    dsl2: String(DEFAULT_TANK_CAPACITY_L),
    ulp1: String(DEFAULT_TANK_CAPACITY_L),
    ulp2: String(DEFAULT_TANK_CAPACITY_L),
  });
  const [capacityBaseline, setCapacityBaseline] = useState(() => normalizeTankCapacities({}));
  const [editingOrderId, setEditingOrderId] = useState(null);
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
  const plannerRowsRef = useRef(plannerRows);
  const savePlannerMetricRowRef = useRef(async () => {});
  useEffect(() => {
    plannerRowsRef.current = plannerRows;
  }, [plannerRows]);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState({
    atg: false,
    order: false,
    pricing: false,
    tankSettings: false,
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
      metricRows.map((metric) => [normalizeDateKey(metric.reading_date), metric])
    );

    const orderByDeliveryDate = Object.fromEntries(
      orderRows.map((o) => [normalizeDateKey(o.delivery_date), o])
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
      },
      tankCapacities: normalizeTankCapacities({
        dsl1: atgRow?.tank_capacity_dsl1,
        dsl2: atgRow?.tank_capacity_dsl2,
        ulp1: atgRow?.tank_capacity_ulp1,
        ulp2: atgRow?.tank_capacity_ulp2,
      }),
      orders: orderRows.map((order) => ({
        id: order.id,
        deliveryDate: order.delivery_date,
        dslVolume: n(order.dsl_vol),
        ulpVolume: n(order.ulp_vol),
        orderReference: order.ref_no ?? "",
        orderedBy: order.ordered_by ?? "",
        dslInvoice: n(order.dsl_invoice ?? order.dsl_invoice_value ?? 0),
        ulpInvoice: n(order.ulp_invoice ?? order.ulp_invoice_value ?? 0),
        notes: order.notes != null ? String(order.notes) : "",
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
        ordered_by: (() => {
          const ord = orderByDeliveryDate[isoDate];
          const fromOrder = String(ord?.ordered_by ?? "").trim();
          const fromMetric = String(
            readMetricField(metricByDate[isoDate], ["ordered_by", "orderedBy"]) || ""
          ).trim();
          return fromOrder || fromMetric;
        })(),
      }))
    );

    setLoading(false);
  }, [monthDates, monthEndIso, monthStartIso, selectedMonthLabel, selectedStore]);

  useEffect(() => {
    fetchPlannerData();
  }, [selectedStore, selectedMonth, fetchPlannerData]);

  const tanks = useMemo(() => {
    const caps = plannerState.tankCapacities ?? normalizeTankCapacities({});
    return [
      {
        label: "DSL Tank 1",
        value: plannerState.atg.dsl1,
        capacity: caps.dsl1,
        highColor: "#185FA5",
      },
      {
        label: "DSL Tank 2",
        value: plannerState.atg.dsl2,
        capacity: caps.dsl2,
        highColor: "#185FA5",
      },
      {
        label: "ULP Tank 1",
        value: plannerState.atg.ulp1,
        capacity: caps.ulp1,
        highColor: "#16a34a",
      },
      {
        label: "ULP Tank 2",
        value: plannerState.atg.ulp2,
        capacity: caps.ulp2,
        highColor: "#16a34a",
      },
    ];
  }, [plannerState.atg, plannerState.tankCapacities]);

  const upsertAtgReadingsRow = useCallback(
    async (payload) => {
      let saveError = null;
      const { error: upsertError } = await supabase
        .from("atg_readings")
        .upsert(payload, { onConflict: "store_name,month_year" });

      if (upsertError) {
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

      return { error: saveError || upsertError };
    },
    [selectedMonthLabel, selectedStore]
  );

  const openCriticalSystemSettings = () => {
    const caps = plannerState.tankCapacities ?? normalizeTankCapacities({});
    setCapacityBaseline({ ...caps });
    setCapacityDraft({
      dsl1: String(caps.dsl1),
      dsl2: String(caps.dsl2),
      ulp1: String(caps.ulp1),
      ulp2: String(caps.ulp2),
    });
    setCriticalSettingsUnlocked(false);
    setCapacityUnlockOpen(false);
    setCapacityUnlockPasscode("");
    setCapacityUnlockError("");
    setIsCriticalSettingsOpen(true);
  };

  const closeCriticalSystemSettings = () => {
    setIsCriticalSettingsOpen(false);
    setCriticalSettingsUnlocked(false);
    setCapacityUnlockOpen(false);
    setCapacityUnlockPasscode("");
    setCapacityUnlockError("");
  };

  const openCapacityUnlockModal = () => {
    setCapacityUnlockPasscode("");
    setCapacityUnlockError("");
    setCapacityUnlockOpen(true);
  };

  const closeCapacityUnlockModal = () => {
    setCapacityUnlockOpen(false);
    setCapacityUnlockPasscode("");
    setCapacityUnlockError("");
  };

  const submitCapacityUnlock = () => {
    if (String(capacityUnlockPasscode).trim() !== TANK_CAPACITY_UNLOCK_CODE) {
      setCapacityUnlockError("Incorrect passcode.");
      return;
    }
    closeCapacityUnlockModal();
    setCriticalSettingsUnlocked(true);
    setToast({ type: "success", message: "Tank capacity fields unlocked." });
  };

  const saveTankCapacities = async () => {
    if (!criticalSettingsUnlocked) {
      setToast({ type: "error", message: "Enable editing first." });
      return;
    }

    const nextCaps = normalizeTankCapacities({
      dsl1: capacityDraft.dsl1,
      dsl2: capacityDraft.dsl2,
      ulp1: capacityDraft.ulp1,
      ulp2: capacityDraft.ulp2,
    });

    const unchanged =
      nextCaps.dsl1 === capacityBaseline.dsl1 &&
      nextCaps.dsl2 === capacityBaseline.dsl2 &&
      nextCaps.ulp1 === capacityBaseline.ulp1 &&
      nextCaps.ulp2 === capacityBaseline.ulp2;

    if (unchanged) {
      setToast({ type: "error", message: "No changes to save." });
      return;
    }

    setSaving((prev) => ({ ...prev, tankSettings: true }));
    const mergedState = {
      ...plannerState,
      tankCapacities: nextCaps,
    };
    const payload = buildAtgReadingsPayload(selectedStore, selectedMonthLabel, mergedState);
    const { error: finalError } = await upsertAtgReadingsRow(payload);

    if (finalError) {
      const errorMessage = getErrorMessage(finalError, "Unknown error while saving tank capacities.");
      console.error("Tank capacity save error (raw):", finalError);
      alert(`Failed to save tank capacities: ${errorMessage}`);
      setToast({ type: "error", message: errorMessage });
      setSaving((prev) => ({ ...prev, tankSettings: false }));
      return;
    }

    updatePlannerState((prev) => ({
      ...prev,
      tankCapacities: nextCaps,
    }));
    setToast({ type: "success", message: "Tank capacities saved." });
    closeCriticalSystemSettings();
    await fetchPlannerData();
    setSaving((prev) => ({ ...prev, tankSettings: false }));
  };

  const handleAtgInput = (key, value) => {
    updatePlannerState((prev) => ({
      ...prev,
      atg: { ...prev.atg, [key]: n(value) },
    }));
  };

  const saveAtgReadings = async () => {
    setSaving((prev) => ({ ...prev, atg: true }));
    const payload = buildAtgReadingsPayload(selectedStore, selectedMonthLabel, plannerState);
    const { error: finalError } = await upsertAtgReadingsRow(payload);

    if (finalError) {
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
    setEditingOrderId(null);
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

  const openEditOrderModal = (order) => {
    setEditingOrderId(order.id);
    setOrderForm({
      deliveryDate: order.deliveryDate,
      dslVolume: order.dslVolume ? String(order.dslVolume) : "",
      ulpVolume: order.ulpVolume ? String(order.ulpVolume) : "",
      orderReference: order.orderReference,
      orderedBy: order.orderedBy,
      dslInvoice: order.dslInvoice ? String(order.dslInvoice) : "",
      ulpInvoice: order.ulpInvoice ? String(order.ulpInvoice) : "",
      notes: order.notes ?? "",
      confirmed: order.confirmed ? "1" : "0",
    });
    setIsOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
    setEditingOrderId(null);
  };

  const saveOrder = async () => {
    if (!orderForm.deliveryDate || !orderForm.orderReference.trim()) return;
    setSaving((prev) => ({ ...prev, order: true }));

    const newOrder = {
      id: editingOrderId ?? `${orderForm.deliveryDate}-${Date.now()}`,
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

    const persistOrderedByToMetrics = async () => {
      const ob = newOrder.orderedBy.trim();
      if (!ob) return;
      const dKey = normalizeDateKey(newOrder.deliveryDate);
      const snap = plannerRowsRef.current.find((r) => normalizeDateKey(r.date) === dKey);
      if (!snap) return;
      await savePlannerMetricRowRef.current(snap.date, { ...snap, ordered_by: ob });
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

    if (editingOrderId) {
      const { error: updateError } = await supabase
        .from("fuel_orders")
        .update(payload)
        .eq("id", editingOrderId)
        .eq("store_name", selectedStore);

      if (updateError) {
        console.error("Order update error:", updateError);
        alert(`Failed to update order: ${updateError.message}`);
        setToast({ type: "error", message: updateError.message });
        setSaving((prev) => ({ ...prev, order: false }));
        return;
      }

      updatePlannerState((prev) => ({
        ...prev,
        orders: prev.orders
          .map((o) =>
            o.id === editingOrderId ? { ...newOrder, id: editingOrderId } : o
          )
          .sort(
            (a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()
          ),
      }));
      const dKey = normalizeDateKey(newOrder.deliveryDate);
      const obTrim = newOrder.orderedBy.trim();
      if (obTrim) {
        setPlannerRows((prev) =>
          prev.map((r) => (normalizeDateKey(r.date) === dKey ? { ...r, ordered_by: obTrim } : r))
        );
      }
      await persistOrderedByToMetrics();
      closeOrderModal();
      setToast({ type: "success", message: "Order updated." });
      await fetchPlannerData();
      setSaving((prev) => ({ ...prev, order: false }));
      return;
    }

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
    const dKeyIns = normalizeDateKey(newOrder.deliveryDate);
    const obIns = newOrder.orderedBy.trim();
    if (obIns) {
      setPlannerRows((prev) =>
        prev.map((r) => (normalizeDateKey(r.date) === dKeyIns ? { ...r, ordered_by: obIns } : r))
      );
    }
    await persistOrderedByToMetrics();
    closeOrderModal();
    setToast({ type: "success", message: "Order saved." });
    await fetchPlannerData();
    setSaving((prev) => ({ ...prev, order: false }));
  };

  const updatePricingForm = (key, value) => {
    setPricingForm((prev) => ({ ...prev, [key]: sanitizeDecimalInput(value) }));
  };

  const pricingMargins = useMemo(
    () => ({
      oldDsl: n(pricingForm.oldRetailDsl) - n(pricingForm.oldCostDsl),
      oldUlp: n(pricingForm.oldRetailUlp) - n(pricingForm.oldCostUlp),
      newDsl: n(pricingForm.newRetailDsl) - n(pricingForm.newCostDsl),
      newUlp: n(pricingForm.newRetailUlp) - n(pricingForm.newCostUlp),
    }),
    [pricingForm]
  );

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

  const ordersVolumeTotals = useMemo(
    () =>
      plannerState.orders.reduce(
        (acc, o) => {
          acc.dsl += n(o.dslVolume);
          acc.ulp += n(o.ulpVolume);
          return acc;
        },
        { dsl: 0, ulp: 0 }
      ),
    [plannerState.orders]
  );

  const updatePlannerCell = (date, field, value) => {
    setPlannerRows((prev) =>
      prev.map((row) => (row.date === date ? { ...row, [field]: value } : row))
    );
  };

  const savePlannerMetricRow = async (date, rowOverride = null) => {
    const row = rowOverride ?? plannerRows.find((entry) => entry.date === date);
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

  savePlannerMetricRowRef.current = savePlannerMetricRow;

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const backHref = useMemo(() => {
    if (returnUrl) {
      try {
        return decodeURIComponent(returnUrl);
      } catch {
        return returnUrl;
      }
    }
    return `/${labelToSlug(selectedStore)}/fuel-management`;
  }, [returnUrl, selectedStore]);

  if (!returnUrl) {
    return (
      <div className="grid min-h-[40vh] place-items-center p-8 text-center text-sm text-slate-600">
        Redirecting to Fuel Management…
      </div>
    );
  }

  if (loading)
    return (
      <div className="space-y-4">
        <AppDrillBack backHref={backHref} />
        <div className="grid min-h-[50vh] place-items-center p-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#ff6e00]" />
            Loading...
          </div>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="space-y-4">
        <AppDrillBack backHref={backHref} />
        <div className="p-6 text-red-600">Error: {error}</div>
      </div>
    );

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={backHref} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Monthly Fuel Planner
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {selectedMonthLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{selectedStore}</p>
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-slate-500">
              Month fuel ordered (L): DSL {ordersVolumeTotals.dsl.toLocaleString("en-ZA")} · ULP{" "}
              {ordersVolumeTotals.ulp.toLocaleString("en-ZA")} · Combined{" "}
              {(ordersVolumeTotals.dsl + ordersVolumeTotals.ulp).toLocaleString("en-ZA")}
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
              onClick={openCriticalSystemSettings}
              title="Critical system settings"
              aria-label="Settings"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() =>
                generateMonthlyAuditPdf({
                  storeName: selectedStore,
                  periodLabel: selectedMonthLabel,
                  monthKeyForFilename: selectedMonth,
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
              + Orders Placed
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
            Monthly Fuel Planner
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

        <Tabs.Content value="monthly" className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Tank fill (ATG)</h3>
                <p className="text-xs text-slate-600">Litres and fill % vs configured capacity</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {tanks.map((tank) => (
                <TankGauge
                  key={tank.label}
                  label={tank.label}
                  value={tank.value}
                  capacity={tank.capacity}
                  highColor={tank.highColor}
                  compact
                />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-amber-50/30 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Daily sales &amp; orders</h4>
                <p className="text-xs text-slate-500">{selectedMonthLabel}</p>
              </div>
              <button
                type="button"
                onClick={openNewOrderModal}
                className="rounded-lg bg-[#ff6e00] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
              >
                Orders Placed
              </button>
            </div>
            <div className="max-h-[min(52vh,560px)] overflow-auto bg-white">
            <table className="w-full text-xs">
              <thead className="z-10 text-slate-600 shadow-sm">
                <tr>
                  <th rowSpan={2} className="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">Day</th>
                  <th colSpan={2} className="sticky top-0 z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-center font-semibold">
                    Forecast <span className="ml-1 text-[10px] font-medium text-slate-400">kL</span>
                  </th>
                  <th colSpan={2} className="sticky top-0 z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-center font-semibold">
                    Actual Sales <span className="ml-1 text-[10px] font-medium text-slate-400">kL</span>
                  </th>
                  <th colSpan={4} className="sticky top-0 z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-center font-semibold">Orders Placed</th>
                  <th rowSpan={2} className="sticky top-0 z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-left font-semibold">Ordered by</th>
                </tr>
                <tr>
                  <th className="sticky top-[33px] z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-left font-semibold">DSL</th>
                  <th className="sticky top-[33px] z-20 border-b border-slate-200/80 bg-slate-50 px-3 py-2 text-left font-semibold">ULP</th>
                  <th className="sticky top-[33px] z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-left font-semibold">DSL</th>
                  <th className="sticky top-[33px] z-20 border-b border-slate-200/80 bg-slate-50 px-3 py-2 text-left font-semibold">ULP</th>
                  <th className="sticky top-[33px] z-20 border-b border-l-2 border-slate-300/80 bg-slate-50 px-3 py-2 text-left font-semibold">DSL vol (L)</th>
                  <th className="sticky top-[33px] z-20 border-b border-slate-200/80 bg-slate-50 px-3 py-2 text-left font-semibold">ULP vol (L)</th>
                  <th className="sticky top-[33px] z-20 border-b border-slate-200/80 bg-slate-50 px-3 py-2 text-left font-semibold">Ref no.</th>
                  <th className="sticky top-[33px] z-20 border-b border-slate-200/80 bg-slate-50 px-3 py-2 text-left font-semibold">Status</th>
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
                    <td className="whitespace-nowrap border-r border-slate-200/90 px-3 py-2 font-medium text-slate-700">
                      {formatPlannerDayWithWeekday(row.date)}
                    </td>
                    <td className="border-l-2 border-slate-300/80 px-3 py-2 text-right">
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
                    <td className="border-l-2 border-slate-300/80 px-3 py-2 text-right">
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
                    <td className="border-l-2 border-slate-300/80 px-3 py-2 text-[#185FA5]">
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
                    <td className="border-l-2 border-slate-300/80 px-3 py-2">
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
            </table>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="atg">
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">ATG Underground Stock</h3>
              <p className="mt-1 text-sm text-slate-500">
                Enter the automated tank gauge (ATG) system reading for each underground tank (litres).
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "DSL Tank 1", valueKey: "dsl1" },
                { label: "DSL Tank 2", valueKey: "dsl2" },
                { label: "ULP Tank 1", valueKey: "ulp1" },
                { label: "ULP Tank 2", valueKey: "ulp2" },
              ].map((tank) => (
                <label
                  key={tank.label}
                  className="flex min-h-[120px] flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <span className="text-sm font-semibold text-slate-800">{tank.label}</span>
                  <span className="text-xs font-semibold text-slate-500">System Reading (ATG)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Litres"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                    value={plannerState.atg[tank.valueKey]}
                    onChange={(e) => handleAtgInput(tank.valueKey, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6">
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
        </Tabs.Content>

        <Tabs.Content value="orders">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Orders</h3>
              <button
                type="button"
                onClick={openNewOrderModal}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Orders Placed
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Delivery Day</th>
                    <th className="px-4 py-3 text-left font-semibold">DSL Volume (L)</th>
                    <th className="px-4 py-3 text-left font-semibold">ULP Volume (L)</th>
                    <th className="px-4 py-3 text-left font-semibold">Order Reference</th>
                    <th className="px-4 py-3 text-right font-semibold">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {plannerState.orders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-slate-500" colSpan={5}>
                        No orders saved yet.
                      </td>
                    </tr>
                  ) : (
                    plannerState.orders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-medium text-slate-700">
                          {formatPlannerDayCell(order.deliveryDate)}
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
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditOrderModal(order)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
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
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Pricing &amp; Margins</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedStore} · {selectedMonthLabel}. Margin = Retail − Cost (updates as you type).
                </p>
              </div>
              <button
                type="button"
                onClick={savePricing}
                disabled={saving.pricing}
                className="shrink-0 rounded-xl bg-[#ff6e00] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving.pricing ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Cost price (R/L)</h4>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Old DSL</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.oldCostDsl}
                      onChange={(e) => updatePricingForm("oldCostDsl", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Old ULP</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.oldCostUlp}
                      onChange={(e) => updatePricingForm("oldCostUlp", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">New DSL</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.newCostDsl}
                      onChange={(e) => updatePricingForm("newCostDsl", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">New ULP</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.newCostUlp}
                      onChange={(e) => updatePricingForm("newCostUlp", e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Retail price (R/L)</h4>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Old DSL</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.oldRetailDsl}
                      onChange={(e) => updatePricingForm("oldRetailDsl", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Old ULP</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.oldRetailUlp}
                      onChange={(e) => updatePricingForm("oldRetailUlp", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">New DSL</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.newRetailDsl}
                      onChange={(e) => updatePricingForm("newRetailDsl", e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">New ULP</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#ff6e00]"
                      value={pricingForm.newRetailUlp}
                      onChange={(e) => updatePricingForm("newRetailUlp", e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Margin (R/L)</h4>
                <p className="mb-3 text-xs text-slate-500">Retail minus cost · negative = loss</p>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Old DSL", value: pricingMargins.oldDsl },
                    { label: "Old ULP", value: pricingMargins.oldUlp },
                    { label: "New DSL", value: pricingMargins.newDsl },
                    { label: "New ULP", value: pricingMargins.newUlp },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-slate-200/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-600">{row.label}</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          row.value < 0 ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        R {row.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              One save writes all cost and retail values to Supabase for this store and month.
            </p>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {isCriticalSettingsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="critical-system-settings-title"
          >
            <h4
              id="critical-system-settings-title"
              className="text-lg font-semibold text-slate-900"
            >
              Critical System Settings
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Tank capacities (litres) — {selectedStore}, {selectedMonthLabel}. Stored with ATG
              readings; monthly planner gauges use these values for fill percentage.
            </p>

            {!criticalSettingsUnlocked ? (
              <>
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current capacities (read-only)
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
                    {[
                      { key: "dsl1", label: "DSL Tank 1" },
                      { key: "dsl2", label: "DSL Tank 2" },
                      { key: "ulp1", label: "ULP Tank 1" },
                      { key: "ulp2", label: "ULP Tank 2" },
                    ].map(({ key, label }) => (
                      <li key={key} className="flex justify-between gap-2 border-b border-slate-200/80 pb-2 last:border-0 last:pb-0">
                        <span className="text-slate-600">{label}</span>
                        <span className="font-semibold tabular-nums">
                          {(plannerState.tankCapacities ?? normalizeTankCapacities({}))[key].toLocaleString("en-ZA")}{" "}
                          L
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  To edit capacities, use <span className="font-semibold">Enable editing</span> and enter
                  the manager passcode in the unlock dialog.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeCriticalSystemSettings}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={openCapacityUnlockModal}
                    className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                  >
                    Enable Editing
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    { key: "dsl1", label: "DSL Tank 1 — Capacity (L)" },
                    { key: "dsl2", label: "DSL Tank 2 — Capacity (L)" },
                    { key: "ulp1", label: "ULP Tank 1 — Capacity (L)" },
                    { key: "ulp2", label: "ULP Tank 2 — Capacity (L)" },
                  ].map(({ key, label }) => (
                    <label key={key} className="block space-y-1.5">
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                        value={capacityDraft[key]}
                        onChange={(e) =>
                          setCapacityDraft((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Saves to Supabase on the same record as ATG readings for this site and month.
                  Monthly planner gauges update immediately after a successful save.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCriticalSettingsUnlocked(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Lock
                  </button>
                  <button
                    type="button"
                    onClick={closeCriticalSystemSettings}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveTankCapacities}
                    disabled={saving.tankSettings}
                    className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving.tankSettings ? "Saving…" : "Save capacities"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {capacityUnlockOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capacity-unlock-title"
          >
            <h4 id="capacity-unlock-title" className="text-lg font-semibold text-slate-900">
              Unlock tank capacities
            </h4>
            <p className="mt-2 text-sm text-slate-600">
              Changing tank capacities affects stock and gauge calculations for this site. Enter the
              manager passcode to enable editing.
            </p>
            <label className="mt-4 block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Passcode</span>
              <input
                type="password"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                value={capacityUnlockPasscode}
                onChange={(e) => {
                  setCapacityUnlockPasscode(e.target.value);
                  if (capacityUnlockError) setCapacityUnlockError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCapacityUnlock();
                  }
                }}
              />
            </label>
            {capacityUnlockError ? (
              <p className="mt-2 text-sm font-medium text-red-600">{capacityUnlockError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCapacityUnlockModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCapacityUnlock}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">
              {editingOrderId ? "Edit order" : "Orders Placed"}
            </h4>

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
                        {formatPlannerDayCell(isoDate)}
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
                onClick={closeOrderModal}
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
                {saving.order ? "Saving..." : editingOrderId ? "Save changes" : "Save Order"}
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

export default function FuelPlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center text-sm text-slate-500">Loading planner…</div>
      }
    >
      <FuelPlannerPageInner />
    </Suspense>
  );
}