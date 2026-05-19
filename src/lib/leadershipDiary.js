export const DIARY_CATEGORIES = [
  {
    value: "shift_handover",
    label: "Shift Handover",
    hint: "e.g. Morning to Afternoon shift: All pumps clear, coffee machine needs cleaning",
    style: "border-l-violet-500 bg-violet-50/80",
    chip: "bg-violet-100 text-violet-800",
  },
  {
    value: "team_commentary",
    label: "Team Commentary",
    hint: "e.g. Team worked well during the rush",
    style: "border-l-emerald-500 bg-emerald-50/80",
    chip: "bg-emerald-100 text-emerald-800",
  },
  {
    value: "operational_note",
    label: "Operational Note",
    hint: "e.g. Escalator technician called, arriving at 2 PM",
    style: "border-l-sky-500 bg-sky-50/80",
    chip: "bg-sky-100 text-sky-800",
  },
];

export const LEADERSHIP_DIARY_SETUP_HINT =
  "Run supabase/migrations/20260519120000_leadership_diary.sql in the Supabase SQL Editor, then reload the API schema.";

export function toDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isTodayDateKey(dateKey) {
  return dateKey === toDateKey(new Date());
}

export function formatDiaryDateLabel(dateKey) {
  if (!dateKey) return "";
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  if (isTodayDateKey(dateKey)) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toDateKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export function getCategoryMeta(value) {
  return DIARY_CATEGORIES.find((c) => c.value === value) || DIARY_CATEGORIES[2];
}

export function isLeadershipDiarySchemaError(message) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("leadership_diary") &&
    (m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find"))
  );
}

export function formatEntryTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}
