"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Settings2, ShieldAlert, Trash2 } from "lucide-react";
import {
  ASSESSMENT_TYPE_DB_VALUE,
  ASSESSMENT_TYPES,
  read,
  todayStr,
} from "../../lib/siteAssessments";
import { supabase } from "../../lib/supabaseBrowser";
import { ASSESSMENT_PASS_SCORE, isAssessmentPass } from "../../lib/assessmentReport";
import {
  ASSESSMENT_TEMPLATE_SETUP_HINT,
  fetchAllAssessmentTemplates,
  isAssessmentTemplateSchemaError,
  seedAssessmentTemplatesIfEmpty,
} from "../../lib/assessmentQuestionService";

const ORANGE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e85f00] disabled:opacity-50";

export default function SiteAssessmentsPanel({ storeName }) {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [assessmentType, setAssessmentType] = useState("csa_forecourt");
  const [assessmentSubject, setAssessmentSubject] = useState("");
  const [assessmentStaffId, setAssessmentStaffId] = useState("");
  const [assessmentAssessor, setAssessmentAssessor] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayStr());
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");

  const loadAssessments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_assessments")
      .select("*")
      .eq("store_name", storeName)
      .order("created_at", { ascending: false });
    if (!error) setAssessments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAssessments();
  }, [storeName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .eq("store_name", storeName)
        .order("full_name");
      if (!cancelled) setStaffProfiles(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeName]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    setSchemaMissing(false);

    const seedResult = await seedAssessmentTemplatesIfEmpty(supabase, storeName, assessmentType);
    if (!seedResult.ok && isAssessmentTemplateSchemaError(seedResult.error)) {
      setSchemaMissing(true);
      setTemplates([]);
      setTemplatesLoading(false);
      return;
    }

    const { data, error } = await fetchAllAssessmentTemplates(supabase, storeName, assessmentType);
    if (error) {
      if (isAssessmentTemplateSchemaError(error.message)) {
        setSchemaMissing(true);
        setTemplates([]);
      } else {
        console.error(error.message);
      }
    } else {
      setTemplates(data || []);
    }
    setTemplatesLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, [storeName, assessmentType]);

  const activeTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);

  const assessmentQuestions = useMemo(() => {
    if (activeTemplates.length) return activeTemplates.map((t) => t.question_text);
    return ASSESSMENT_TYPES[assessmentType]?.questions ?? [];
  }, [activeTemplates, assessmentType]);

  useEffect(() => {
    setAssessmentAnswers(Array(assessmentQuestions.length).fill(null));
  }, [assessmentQuestions.length, assessmentType]);
  const yesCount = useMemo(() => assessmentAnswers.filter((a) => a === true).length, [assessmentAnswers]);
  const allAssessmentAnswered = useMemo(
    () => assessmentAnswers.length > 0 && assessmentAnswers.every((a) => a !== null),
    [assessmentAnswers]
  );
  const scorePct = useMemo(
    () => Math.round((yesCount / Math.max(assessmentQuestions.length, 1)) * 100),
    [yesCount, assessmentQuestions.length]
  );
  const remediationItems = useMemo(
    () =>
      assessmentQuestions
        .map((question, index) => ({ question, index: index + 1, answer: assessmentAnswers[index] }))
        .filter((item) => item.answer === false),
    [assessmentAnswers, assessmentQuestions]
  );

  const metrics = useMemo(() => {
    const total = assessments.length;
    const avgScore = total
      ? Math.round(assessments.reduce((sum, row) => sum + Number(read(row, ["score"], 0)), 0) / total)
      : 0;
    const passCount = assessments.filter((row) => isAssessmentPass(read(row, ["score"], 0))).length;
    return { total, avgScore, passRate: total ? Math.round((passCount / total) * 100) : 0 };
  }, [assessments]);

  const submitAssessment = async () => {
    if (!assessmentSubject.trim() || !assessmentAssessor.trim()) {
      alert("Subject and Assessor are required.");
      return;
    }
    if (!allAssessmentAnswered) {
      alert("Please answer all assessment questions.");
      return;
    }

    const payload = {
      store_name: storeName,
      assessment_type: ASSESSMENT_TYPE_DB_VALUE[assessmentType] || "Forecourt",
      assessor_name: assessmentAssessor.trim(),
      score: scorePct,
      ...(assessmentStaffId ? { staff_id: assessmentStaffId } : {}),
      answers: {
        version: "v1",
        assessmentKey: assessmentType,
        assessmentLabel: ASSESSMENT_TYPES[assessmentType].label,
        assessmentDate,
        subjectName: assessmentSubject.trim(),
        questions: assessmentQuestions,
        values: assessmentAnswers,
        yesCount,
        noCount: assessmentAnswers.filter((a) => a === false).length,
        remediationItems,
        passThreshold: ASSESSMENT_PASS_SCORE,
        result: isAssessmentPass(scorePct) ? "Pass" : "Fail",
      },
    };

    const { error } = await supabase.from("site_assessments").insert(payload);
    if (error) {
      alert(error.message || "Failed to submit.");
      return;
    }
    setAssessmentSubject("");
    setAssessmentStaffId("");
    setAssessmentAssessor("");
    setAssessmentAnswers(Array(assessmentQuestions.length).fill(null));
    await loadAssessments();
  };

  const addTemplateQuestion = async () => {
    const text = newQuestionText.trim();
    if (!text) {
      alert("Question text is required.");
      return;
    }
    if (schemaMissing) {
      alert(ASSESSMENT_TEMPLATE_SETUP_HINT);
      return;
    }
    const sortOrder = activeTemplates.length;
    const { error } = await supabase.from("assessment_question_templates").insert({
      store_name: storeName,
      assessment_key: assessmentType,
      question_text: text,
      sort_order: sortOrder,
      is_active: true,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewQuestionText("");
    await loadTemplates();
  };

  const deactivateQuestion = async (id) => {
    if (!confirm("Remove this question from future assessments of this type?")) return;
    const { error } = await supabase
      .from("assessment_question_templates")
      .update({ is_active: false })
      .eq("id", id)
      .eq("store_name", storeName)
      .eq("assessment_key", assessmentType);
    if (error) alert(error.message);
    else await loadTemplates();
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average score</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.avgScore}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pass rate</p>
          <p className="mt-2 text-2xl font-bold text-[#ff6a00]">{metrics.passRate}%</p>
          <p className="mt-1 text-[10px] text-slate-400">Audits scoring above 75%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audits ({storeName})</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardList className="h-4 w-4 text-[#ff6a00]" />
            Deep assessment — {storeName}
          </h3>
          <button
            type="button"
            onClick={() => setManageMode((v) => !v)}
            disabled={schemaMissing}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              manageMode
                ? "border-[#ff6a00] bg-orange-50 text-[#9a3412]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Settings2 className={`h-4 w-4 ${manageMode ? "text-[#ff6a00]" : "text-slate-500"}`} />
            {manageMode ? "Done managing" : "Manage questions"}
          </button>
        </div>

        {schemaMissing ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Database setup required for custom questions</p>
            <p className="mt-1 text-xs">{ASSESSMENT_TEMPLATE_SETUP_HINT}</p>
            <p className="mt-2 text-xs text-amber-800">Using built-in questions until the migration is applied.</p>
          </div>
        ) : null}

        {manageMode && !schemaMissing ? (
          <section className="mt-4 overflow-hidden rounded-lg border border-orange-200">
            <div className="border-b border-orange-100 bg-orange-50/50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {ASSESSMENT_TYPES[assessmentType]?.label} — question template
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {storeName} only · {activeTemplates.length} active
                {templatesLoading ? " · loading…" : ""}
              </p>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              {activeTemplates.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No active questions. Add one below.</p>
              ) : (
                activeTemplates.map((t, index) => (
                  <div key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80">
                    <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{t.question_text}</p>
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
            <div className="border-t border-slate-200 bg-slate-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add question</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="New assessment question…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addTemplateQuestion()}
                />
                <button type="button" onClick={addTemplateQuestion} className={ORANGE_BTN}>
                  <Plus className="h-4 w-4" />
                  Add question
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment type</span>
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff6e00] focus:ring-2 focus:ring-[#ff6e00]/20"
            >
              {Object.entries(ASSESSMENT_TYPES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</span>
            <input value={storeName} readOnly className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input
              value={assessmentSubject}
              onChange={(e) => setAssessmentSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff profile</span>
            <select
              value={assessmentStaffId}
              onChange={(e) => {
                const v = e.target.value;
                setAssessmentStaffId(v);
                const person = staffProfiles.find((s) => s.id === v);
                if (person) setAssessmentSubject(person.full_name);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Not linked</option>
              {staffProfiles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessor</span>
            <input
              value={assessmentAssessor}
              onChange={(e) => setAssessmentAssessor(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">
            Score: {scorePct}% ({yesCount}/{assessmentQuestions.length} Yes)
          </p>
          {remediationItems.length ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Remediation required ({remediationItems.length})
            </p>
          ) : null}
        </div>

        <div className="mt-4 max-h-[360px] space-y-3 overflow-auto rounded-xl border border-slate-200 p-3">
          {templatesLoading && !schemaMissing ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading questions…</p>
          ) : null}
          {(!templatesLoading || schemaMissing) &&
            assessmentQuestions.map((question, index) => (
            <div
              key={activeTemplates[index]?.id ?? `${index}-${question}`}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="text-sm text-slate-800">
                {index + 1}. {question}
              </p>
              <div className="mt-2 flex gap-2">
                {["Yes", "No"].map((label, i) => {
                  const val = i === 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setAssessmentAnswers((prev) => {
                          const next = [...prev];
                          next[index] = val;
                          return next;
                        })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        assessmentAnswers[index] === val
                          ? val
                            ? "bg-emerald-600 text-white"
                            : "bg-red-600 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitAssessment}
            disabled={!allAssessmentAnswered || loading || templatesLoading || assessmentQuestions.length === 0}
            className="rounded-lg bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e85f00] disabled:opacity-60"
          >
            Submit assessment
          </button>
        </div>
      </section>

      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Past audits and reports are in the{" "}
        <a
          href={`/operations-team-hub?store=${encodeURIComponent(storeName)}`}
          className="font-semibold text-[#ff6a00] hover:underline"
        >
          Operations Team Hub
        </a>
        .
      </p>
    </div>
  );
}
