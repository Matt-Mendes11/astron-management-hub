"use client";

import { Printer, X } from "lucide-react";
import { parseAssessmentAnswers, printAssessmentReport } from "../../lib/assessmentReport";
import { read } from "../../lib/siteAssessments";

export default function AssessmentReportModal({ record, storeName, onClose }) {
  if (!record) return null;

  const { meta, rows } = parseAssessmentAnswers(record);
  const score = Math.round(Number(meta.score) || Number(read(record, ["score"], 0)));
  const dateLabel = record.created_at
    ? new Date(record.created_at).toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : meta.assessmentDate || "—";

  const handlePrint = () => {
    printAssessmentReport({ record, storeName });
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body aside,
  body header,
  body nav {
    display: none !important;
  }
  body main {
    padding: 0 !important;
  }
  .no-print {
    display: none !important;
  }
  .assessment-report-backdrop {
    position: static !important;
    background: transparent !important;
    padding: 0 !important;
  }
  .assessment-report-dialog {
    max-height: none !important;
    overflow: visible !important;
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: none !important;
  }
}
`,
        }}
      />

      <div
        className="assessment-report-backdrop no-print fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-report-title"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div
          className="assessment-report-dialog max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h2 id="assessment-report-title" className="text-sm font-semibold text-slate-900">
              Assessment report
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ff6a00] px-3 py-2 text-xs font-semibold text-white hover:bg-[#e85f00]"
              >
                <Printer className="h-4 w-4" />
                Print audit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6" id="assessment-report-body">
            <div className="border-b-4 border-[#ff6a00] pb-4">
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#311162]">ASTRON ENERGY</p>
              <h3 className="mt-1 text-xl font-semibold text-[#311162]">Site Assessment Report</h3>
              <p className="mt-1 text-sm text-slate-500">
                {storeName} · {dateLabel}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Type</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{meta.label}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Subject</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{meta.subjectName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Assessor</p>
                <p className="mt-1 text-sm text-slate-800">{meta.assessor}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Score</p>
                <p className="mt-1 text-2xl font-bold text-[#311162]">{score}%</p>
                <p className="text-xs font-semibold text-slate-600">{meta.result}</p>
              </div>
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2 w-20">Answer</th>
                  <th className="px-3 py-2">Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      No questions recorded for this audit.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.index}>
                      <td className="px-3 py-3 text-slate-400 tabular-nums">{row.index}</td>
                      <td className="px-3 py-3 text-slate-800">{row.question}</td>
                      <td
                        className={`px-3 py-3 font-bold ${row.isYes ? "text-emerald-700" : row.isNo ? "text-red-700" : "text-slate-400"}`}
                      >
                        {row.isYes ? "Yes" : row.isNo ? "No" : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {row.isNo && row.remediation ? row.remediation : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <p className="mt-8 text-[11px] text-slate-400">
              Confidential — {storeName} · Generated {new Date().toLocaleString("en-ZA")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
