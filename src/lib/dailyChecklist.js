export const CHECKLIST_STATUSES = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  OVERDUE: "OVERDUE",
};

export const CHECKLIST_CATEGORIES = [
  { value: "equipment", label: "Equipment & Forecourt" },
  { value: "duties", label: "Shift Duties" },
  { value: "ppe", label: "PPE & Safety" },
];

export const DEFAULT_TEMPLATE_QUESTIONS = {
  equipment: [
    "Retail dispensing pumps turned ON and fully functioning",
    "Payment24 Terminal is live and operational",
    "Driveway clean, well-maintained, free from litter / oil spills",
    "Forecourt well-lit (canopy lights, pole lights working)",
    "Shop and promotion signage correctly displayed",
    "Waste bins emptied, clean, not overflowing",
    "Fire extinguishers in place, unobstructed, seals intact",
    "First aid kit stocked and accessible",
    "Spill kit stocked and accessible",
    "Forecourt floor free of cracks/trip hazards",
    "No fuel leaks under / around pumps or tanks",
    "Safety signage visible",
    "Public restrooms clean, stocked, maintained",
    "Emergency contact numbers displayed at till",
  ],
  duties: [
    "Pump readings captured on handover sheet",
    "Cash-up / cash drop completed and signed",
    "Shift handover book signed by outgoing & incoming",
    "CCTV operational — no offline cameras",
    "Alarm / panic system tested",
    "All outgoing cash deposits logged",
    "Fuel stock sticks taken, reconciled with Infinity",
    "Fuel delivery notes filed (if delivery received)",
    "Site register up to date",
    "Incident / near-miss register reviewed",
    "Dip readings recorded",
    "Variance report reviewed (yesterday)",
    "Next shift briefed on outstanding items",
  ],
  ppe: [
    "Reflective vests worn by all forecourt staff",
    "Safety shoes worn by all on-site staff",
    "Name badges worn and visible",
    "Uniforms clean, presentable, compliant",
    "Gloves available at pumps",
    "Hand sanitiser available at till / pumps",
    "Eye-wash station unobstructed and functional",
    "Fire blanket in kitchen (FreshStop) accessible",
    "Kitchen staff wearing hairnets / hats where required",
    "Food-handler certificates displayed",
    "Slip-resistant mats at till / FreshStop counter",
    "Cleaning chemicals labelled & stored correctly",
    "MSDS sheets available on site",
  ],
};

export const CHECKLIST_SETUP_HINT =
  "Run supabase/migrations/20260520120000_daily_checklist_audit.sql in Supabase SQL Editor, then reload the API schema.";

export function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatCheckDate(dateKey) {
  if (!dateKey) return "—";
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? dateKey
    : d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function categoryLabel(value) {
  return CHECKLIST_CATEGORIES.find((c) => c.value === value)?.label || value;
}

/** Short tag for UI chips (e.g. Forecourt, Duties, Safety). */
export function categoryTag(value) {
  const map = { equipment: "Forecourt", duties: "Duties", ppe: "Safety" };
  return map[value] || categoryLabel(value);
}

export function statusBadgeClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return "bg-slate-100 text-slate-700 ring-slate-200/80";
  if (s === "OVERDUE") return "bg-red-50 text-red-800 ring-red-200/80";
  if (s === "PENDING") return "bg-orange-50 text-[#c2410c] ring-orange-200/80";
  return "bg-slate-100 text-slate-600 ring-slate-200/80";
}

export function computeChecklistScore(responses) {
  if (!responses?.length) return 0;
  const yes = responses.filter((r) => r.answer === true).length;
  return Math.round((yes / responses.length) * 100);
}

export function isChecklistAuditSchemaError(message) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    (m.includes("checklist_question_templates") ||
      m.includes("checklist_responses") ||
      m.includes("schema cache")) &&
    (m.includes("could not find") || m.includes("does not exist") || m.includes("schema cache"))
  );
}

export function groupQuestionsByCategory(questions) {
  const groups = {};
  for (const cat of CHECKLIST_CATEGORIES) {
    groups[cat.value] = [];
  }
  for (const q of questions) {
    const key = q.category || "equipment";
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  }
  return groups;
}
