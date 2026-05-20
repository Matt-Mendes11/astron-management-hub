"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { labelToSlug } from "../lib/stores";
import {
  DIARY_CATEGORIES,
  LEADERSHIP_DIARY_SETUP_HINT,
  formatDiaryDateLabel,
  formatEntryTime,
  getCategoryMeta,
  isLeadershipDiarySchemaError,
  isTodayDateKey,
  toDateKey,
} from "../lib/leadershipDiary";
import { supabase } from "../lib/supabaseBrowser";

const DEFAULT_BRANCH = "Hillcrest";

const emptyForm = () => ({
  category: "operational_note",
  content: "",
  author_name: "",
});

function DiaryEntryCard({ entry, onEdit, onDelete, deleting, compact }) {
  const meta = getCategoryMeta(entry.category);
  const edited = entry.updated_at && entry.updated_at !== entry.created_at;

  return (
    <article
      className={`rounded-xl border-l-4 ${meta.style} ${
        compact ? "px-3 py-3" : "px-4 py-4"
      } shadow-sm ring-1 ring-slate-200/60`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatEntryTime(entry.created_at)}
            {edited ? " · updated" : ""}
          </span>
        </div>
        {onEdit || onDelete ? (
          <div className="flex items-center gap-1.5">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(entry)}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className={`mt-2 whitespace-pre-wrap text-slate-800 ${compact ? "text-sm leading-relaxed" : "text-[15px] leading-relaxed"}`}>
        {entry.content}
      </p>
      {entry.author_name ? (
        <p className="mt-2 text-[11px] font-medium text-slate-500">— {entry.author_name}</p>
      ) : null}
    </article>
  );
}

export default function LeadershipDiary({ compact = false, storeName, storeSlug }) {
  const searchParams = useSearchParams();
  const selectedBranch = storeName || searchParams.get("store") || DEFAULT_BRANCH;
  const activeStoreSlug = storeSlug || labelToSlug(selectedBranch);
  const diaryHref = `/${activeStoreSlug}/leadership-diary`;

  const [selectedDate, setSelectedDate] = useState(() => toDateKey());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const activeDate = compact ? toDateKey() : selectedDate;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    setSchemaMissing(false);

    const { data, error: qErr } = await supabase
      .from("leadership_diary_entries")
      .select("id, branch_id, entry_date, category, content, author_name, created_at, updated_at")
      .eq("branch_id", selectedBranch)
      .eq("entry_date", activeDate)
      .order("created_at", { ascending: true });

    if (qErr) {
      if (isLeadershipDiarySchemaError(qErr.message)) {
        setSchemaMissing(true);
        setEntries([]);
      } else {
        setError(qErr.message);
        setEntries([]);
      }
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  }, [selectedBranch, activeDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const sectionTitle = useMemo(() => {
    if (compact) return "Today's Leadership Diary";
    return isTodayDateKey(selectedDate) ? "Today's entries" : `Entries for ${formatDiaryDateLabel(selectedDate)}`;
  }, [compact, selectedDate]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      category: entry.category || "operational_note",
      content: entry.content || "",
      author_name: entry.author_name || "",
    });
    setModalOpen(true);
  };

  const saveEntry = async () => {
    const content = form.content.trim();
    if (!content) {
      alert("Please enter a note.");
      return;
    }
    setSaving(true);
    const payload = {
      branch_id: selectedBranch,
      entry_date: activeDate,
      category: form.category,
      content,
      author_name: form.author_name.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("leadership_diary_entries").update(payload).eq("id", editingId)
      : await supabase.from("leadership_diary_entries").insert(payload);

    setSaving(false);
    if (result.error) {
      if (isLeadershipDiarySchemaError(result.error.message)) {
        setSchemaMissing(true);
      }
      alert(result.error.message || "Could not save entry.");
      return;
    }
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    await loadEntries();
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm("Delete this diary entry? This cannot be undone.")) return;
    setDeletingId(entry.id);
    const { error: deleteError } = await supabase
      .from("leadership_diary_entries")
      .delete()
      .eq("id", entry.id)
      .eq("branch_id", selectedBranch);
    if (deleteError) {
      alert(deleteError.message || "Could not delete entry.");
    } else {
      if (editingId === entry.id) {
        setModalOpen(false);
        setEditingId(null);
        setForm(emptyForm());
      }
      await loadEntries();
    }
    setDeletingId("");
  };

  const shellClass = compact
    ? "rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5 shadow-sm ring-1 ring-slate-100"
    : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8";

  const feedEntries = compact ? entries.slice(-6) : entries;

  return (
    <>
      <section className={shellClass}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex shrink-0 items-center justify-center rounded-xl bg-[#311162] text-white shadow-md ${
                compact ? "h-10 w-10" : "h-11 w-11"
              }`}
            >
              <BookOpen className={compact ? "h-5 w-5" : "h-5 w-5"} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Leadership diary</p>
              <h3 className={`font-semibold tracking-tight text-slate-900 ${compact ? "text-lg" : "text-2xl"}`}>
                {sectionTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {selectedBranch}
                {!compact ? (
                  <>
                    <span className="text-slate-300"> · </span>
                    {formatDiaryDateLabel(selectedDate)}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!compact ? (
              <>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    max={toDateKey()}
                    onChange={(e) => setSelectedDate(e.target.value || toDateKey())}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-[#311162]/40 focus:ring-2 focus:ring-[#311162]/15"
                  />
                </label>
                <button
                  type="button"
                  onClick={openAdd}
                  disabled={schemaMissing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#311162] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#3d1a7a] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Add note
                </button>
              </>
            ) : (
              <Link
                href={diaryHref}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#311162] shadow-sm hover:bg-slate-50"
              >
                Open diary
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </Link>
            )}
          </div>
        </div>

        {schemaMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
            <p className="font-bold">Leadership diary database not set up</p>
            <p className="mt-2">{LEADERSHIP_DIARY_SETUP_HINT}</p>
          </div>
        ) : error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading diary…</p>
        ) : feedEntries.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed border-slate-300 bg-white/60 text-center text-slate-500 ${
              compact ? "py-10 text-sm" : "py-14 text-base"
            }`}
          >
            {compact
              ? "No diary notes for today yet."
              : `No entries for ${formatDiaryDateLabel(selectedDate).toLowerCase()}. Add the first note.`}
          </div>
        ) : (
          <div className={`space-y-3 ${compact ? "" : "max-w-3xl"}`}>
            {feedEntries.map((entry) => (
              <DiaryEntryCard
                key={entry.id}
                entry={entry}
                compact={compact}
                onEdit={compact ? undefined : openEdit}
                onDelete={compact ? undefined : deleteEntry}
                deleting={deletingId === entry.id}
              />
            ))}
            {compact && entries.length > feedEntries.length ? (
              <p className="text-center text-xs text-slate-500">
                +{entries.length - feedEntries.length} more today —{" "}
                <Link href={diaryHref} className="font-semibold text-[#311162] hover:underline">
                  view all
                </Link>
              </p>
            ) : null}
          </div>
        )}

        {compact && !schemaMissing && !loading ? (
          <div className="mt-4 flex justify-center">
            <Link
              href={diaryHref}
              className="text-xs font-semibold text-[#311162] hover:underline"
            >
              Manage diary entries →
            </Link>
          </div>
        ) : null}
      </section>

      {modalOpen && !compact ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div
            className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="shrink-0 border-b border-slate-100 px-6 py-5">
              <h4 className="text-lg font-bold text-slate-900">{editingId ? "Edit diary note" : "Add diary note"}</h4>
              <p className="mt-1 text-sm text-slate-500">
                {formatDiaryDateLabel(selectedDate)} · {selectedBranch}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#311162]/40 focus:ring-2 focus:ring-[#311162]/15"
                >
                  {DIARY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">{getCategoryMeta(form.category).hint}</p>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Note</span>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Write your handover, commentary, or operational update…"
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#311162]/40 focus:ring-2 focus:ring-[#311162]/15"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Your name (optional)</span>
                <input
                  type="text"
                  value={form.author_name}
                  onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#311162]/40 focus:ring-2 focus:ring-[#311162]/15"
                  placeholder="e.g. M. Mendes"
                />
              </label>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingId(null);
                }}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEntry}
                disabled={saving}
                className="rounded-xl bg-[#311162] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add entry"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
