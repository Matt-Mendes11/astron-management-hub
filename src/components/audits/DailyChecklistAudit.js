"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_SETUP_HINT,
  CHECKLIST_STATUSES,
  categoryTag,
  formatCheckDate,
  isChecklistAuditSchemaError,
  statusBadgeClass,
  todayDateKey,
  yesterdayDateKey,
} from "../../lib/dailyChecklist";
import {
  fetchActiveTemplates,
  fetchAllTemplates,
  fetchChecklistHistory,
  seedTemplatesIfEmpty,
  submitChecklistCompletion,
  syncDailyChecklistLifecycle,
} from "../../lib/dailyChecklistService";
import { supabase } from "../../lib/supabaseBrowser";
import { labelToSlug } from "../../lib/stores";

const ORANGE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e85f00] disabled:opacity-50";

function YesNoToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
      {[
        { label: "Yes", val: true },
        { label: "No", val: false },
      ].map(({ label, val }) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(val)}
          className={`min-w-[52px] rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === val
              ? val
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="flex-1 border-r border-slate-100 px-4 py-3 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DailyChecklistAudit({ storeName }) {
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [error, setError] = useState("");
  const [todayChecklist, setTodayChecklist] = useState(null);
  const [yesterdayOverdue, setYesterdayOverdue] = useState(false);
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [manageMode, setManageMode] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [flatQuestions, setFlatQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [completedBy, setCompletedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ category: "equipment", text: "" });

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError("");
    setSchemaMissing(false);

    const seedResult = await seedTemplatesIfEmpty(supabase, storeName);
    if (!seedResult.ok && isChecklistAuditSchemaError(seedResult.error)) {
      setSchemaMissing(true);
      setLoading(false);
      return;
    }
    if (!seedResult.ok && seedResult.error) setError(seedResult.error);

    const lifecycle = await syncDailyChecklistLifecycle(supabase, storeName);
    if (!lifecycle.ok) {
      if (isChecklistAuditSchemaError(lifecycle.error)) setSchemaMissing(true);
      else setError(lifecycle.error || "Failed to sync checklist.");
      setLoading(false);
      return;
    }

    setTodayChecklist(lifecycle.today);
    setYesterdayOverdue(lifecycle.yesterdayOverdue);

    const [histRes, tmplRes] = await Promise.all([
      fetchChecklistHistory(supabase, storeName),
      fetchAllTemplates(supabase, storeName),
    ]);

    if (histRes.error) {
      if (isChecklistAuditSchemaError(histRes.error.message)) setSchemaMissing(true);
      else setError(histRes.error.message);
    } else {
      setHistory(histRes.data || []);
    }

    if (tmplRes.error) {
      if (isChecklistAuditSchemaError(tmplRes.error.message)) setSchemaMissing(true);
    } else {
      setTemplates(tmplRes.data || []);
    }

    setLoading(false);
  }, [storeName]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const todayStatus = String(todayChecklist?.status || CHECKLIST_STATUSES.PENDING);
  const isTodayPending = todayStatus.toUpperCase() === CHECKLIST_STATUSES.PENDING.toUpperCase();
  const isTodayComplete = todayStatus.toUpperCase() === CHECKLIST_STATUSES.COMPLETED.toUpperCase();
  const canFillToday = !isTodayComplete && todayChecklist?.id;

  const activeTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);

  const quickStats = useMemo(() => {
    const yesterdayRow = history.find((r) => String(r.check_date) === yesterdayDateKey());
    const lastScored = history.find(
      (r) =>
        r.score != null &&
        String(r.status || "").toUpperCase() === CHECKLIST_STATUSES.COMPLETED.toUpperCase()
    );
    const yesterdayStatus = yesterdayRow?.status
      ? String(yesterdayRow.status)
      : yesterdayOverdue
        ? CHECKLIST_STATUSES.OVERDUE
        : "-";

    return {
      totalQuestions: activeTemplates.length,
      lastScore: lastScored?.score != null ? `${Math.round(Number(lastScored.score))}%` : "-",
      yesterdayStatus,
    };
  }, [activeTemplates.length, history, yesterdayOverdue]);

  const openFillIn = async () => {
    const { data, error: qErr } = await fetchActiveTemplates(supabase, storeName);
    if (qErr) {
      alert(qErr.message || "Could not load questions.");
      return;
    }
    if (!data?.length) {
      alert("No active questions. Add questions in Manage Questions first.");
      return;
    }
    const ordered = [...data].sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      return cat !== 0 ? cat : (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    setFlatQuestions(ordered);
    setAnswers({});
    setCompletedBy("");
    setFillOpen(true);
  };

  const setAnswer = (questionId, patch) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  };

  const submitFillIn = async () => {
    for (const q of flatQuestions) {
      const a = answers[q.id];
      if (a?.answer === undefined || a?.answer === null) {
        alert("Please answer every question.");
        return;
      }
      if (a.answer === false && !String(a.remediationNote || "").trim()) {
        alert(`Remediation required for question ${flatQuestions.indexOf(q) + 1}.`);
        return;
      }
    }

    setSaving(true);
    const responses = flatQuestions.map((q) => ({
      questionId: q.id,
      category: q.category,
      questionText: q.question_text,
      answer: answers[q.id].answer,
      remediationNote: answers[q.id].remediationNote,
    }));

    const result = await submitChecklistCompletion(supabase, {
      checklistId: todayChecklist.id,
      storeName,
      responses,
      completedBy,
    });
    setSaving(false);

    if (!result.ok) {
      alert(result.error || "Submit failed.");
      return;
    }
    setFillOpen(false);
    await bootstrap();
  };

  const addTemplateQuestion = async () => {
    const text = newQuestion.text.trim();
    if (!text) {
      alert("Question text is required.");
      return;
    }
    const sortOrder = templates.filter((t) => t.category === newQuestion.category && t.is_active).length;
    const { error: insErr } = await supabase.from("checklist_question_templates").insert({
      store_name: storeName,
      category: newQuestion.category,
      question_text: text,
      sort_order: sortOrder,
      is_active: true,
    });
    if (insErr) {
      alert(insErr.message);
      return;
    }
    setNewQuestion({ category: newQuestion.category, text: "" });
    const { data } = await fetchAllTemplates(supabase, storeName);
    setTemplates(data || []);
  };

  const deactivateQuestion = async (id) => {
    if (!confirm("Remove this question from future checklists?")) return;
    const { error: upErr } = await supabase
      .from("checklist_question_templates")
      .update({ is_active: false })
      .eq("id", id)
      .eq("store_name", storeName);
    if (upErr) alert(upErr.message);
    else {
      const { data } = await fetchAllTemplates(supabase, storeName);
      setTemplates(data || []);
    }
  };

  if (schemaMissing) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-semibold">Database setup required</p>
        <p className="mt-2 text-xs">{CHECKLIST_SETUP_HINT}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {yesterdayOverdue ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p>
            <span className="font-semibold">Overdue:</span> {formatCheckDate(yesterdayDateKey())} checklist was not
            completed on time.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Daily audit status */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Daily audit status</h3>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              {isTodayPending && canFillToday ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-[#9a3412]">
                  Today&apos;s checklist is ready to be completed.
                </div>
              ) : isTodayComplete ? (
                <p className="text-sm text-slate-600">
                  Today&apos;s checklist is complete
                  {todayChecklist?.score != null ? (
                    <span className="font-semibold text-slate-900">
                      {" "}
                      - Score {Math.round(Number(todayChecklist.score))}%
                    </span>
                  ) : null}
                  .
                </p>
              ) : null}

              <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
                <StatCell label="Total questions" value={quickStats.totalQuestions} />
                <StatCell label="Last score" value={quickStats.lastScore} />
                <StatCell label="Yesterday's status" value={quickStats.yesterdayStatus} />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {canFillToday ? (
                  <button type="button" onClick={openFillIn} className={ORANGE_BTN}>
                    Fill in checklist
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setManageMode((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                    manageMode
                      ? "border-[#ff6a00] bg-orange-50 text-[#9a3412]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Settings2 className={`h-4 w-4 ${manageMode ? "text-[#ff6a00]" : "text-slate-500"}`} />
                  {manageMode ? "Done managing" : "Manage questions"}
                </button>
                {isTodayComplete ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadgeClass(todayStatus)}`}
                  >
                    {todayStatus}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      {manageMode ? (
        <section className="rounded-lg border border-orange-200 bg-white shadow-sm">
          <div className="border-b border-orange-100 bg-orange-50/50 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Store checklist template</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {activeTemplates.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No active questions yet. Add one below.</p>
            ) : (
              activeTemplates.map((t, index) => (
                <div key={t.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/80">
                  <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {categoryTag(t.category)}
                    </span>
                    <p className="mt-1.5 text-sm leading-snug text-slate-800">{t.question_text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deactivateQuestion(t.id)}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/50 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Add question</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={newQuestion.category}
                onChange={(e) => setNewQuestion((f) => ({ ...f, category: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-40"
              >
                {CHECKLIST_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {categoryTag(c.value)}
                  </option>
                ))}
              </select>
              <input
                value={newQuestion.text}
                onChange={(e) => setNewQuestion((f) => ({ ...f, text: e.target.value }))}
                placeholder="New checklist question..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button type="button" onClick={addTemplateQuestion} className={ORANGE_BTN}>
                <Plus className="h-4 w-4" />
                Add question
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <p className="text-center text-sm text-slate-600">
        <Link
          href={`/${labelToSlug(storeName)}/operations-team-hub`}
          className="font-semibold text-[#ff6a00] hover:underline"
        >
          Check document history in Operations Team Hub →
        </Link>
      </p>

      {/* Fill-in: physical audit sheet */}
      {fillOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100/95">
          <div className="mx-auto min-h-full max-w-3xl px-4 py-8">
            <div className="rounded-lg border border-slate-200 bg-white shadow-md">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Daily operational audit
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-900">{storeName}</h4>
                    <p className="text-sm text-slate-500">{formatCheckDate(todayDateKey())}</p>
                  </div>
                  <button type="button" onClick={() => setFillOpen(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-slate-600">Completed by</span>
                  <input
                    value={completedBy}
                    onChange={(e) => setCompletedBy(e.target.value)}
                    className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Name"
                  />
                </label>
              </div>

              <div className="divide-y divide-slate-100 px-6">
                {flatQuestions.map((q, index) => (
                  <div key={q.id} className="py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="max-w-[85%] text-sm leading-relaxed text-slate-900">
                        <span className="mr-2 font-semibold tabular-nums text-slate-400">{index + 1}.</span>
                        {q.question_text}
                      </p>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {categoryTag(q.category)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <YesNoToggle
                        value={answers[q.id]?.answer}
                        onChange={(val) =>
                          setAnswer(q.id, {
                            answer: val,
                            remediationNote: answers[q.id]?.remediationNote,
                          })
                        }
                      />
                    </div>
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        answers[q.id]?.answer === false ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <label className="block border-l-4 border-red-500 bg-red-50/50 pl-3 pr-2 py-2">
                          <span className="text-xs font-semibold text-red-800">Remediation required</span>
                          <textarea
                            rows={2}
                            value={answers[q.id]?.remediationNote || ""}
                            onChange={(e) =>
                              setAnswer(q.id, { ...answers[q.id], remediationNote: e.target.value })
                            }
                            className="mt-1 w-full resize-none rounded-md border border-red-100 bg-white px-2 py-1.5 text-sm outline-none focus:border-red-300"
                            placeholder="Describe corrective action..."
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setFillOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="button" onClick={submitFillIn} disabled={saving} className={ORANGE_BTN}>
                  {saving ? "Submitting..." : "Submit checklist"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
