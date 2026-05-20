"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import {
  CHECKLIST_STATUSES,
  formatCheckDate,
  statusBadgeClass,
} from "../../lib/dailyChecklist";
import { fetchChecklistHistory, fetchChecklistResponses } from "../../lib/dailyChecklistService";
import { printChecklistReport } from "../../lib/checklistPrint";
import { supabase } from "../../lib/supabaseBrowser";

export default function ChecklistDocumentHistoryPanel({ storeName }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await fetchChecklistHistory(supabase, storeName);
      if (!cancelled) {
        if (!error) setHistory(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeName]);

  const handleViewPdf = async (row) => {
    const { data: responses, error: rErr } = await fetchChecklistResponses(supabase, row.id);
    if (rErr || !responses?.length) {
      alert(rErr?.message || "No response data available.");
      return;
    }
    printChecklistReport({ checklist: row, responses, storeName });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <FileText className="h-4 w-4 text-[#ff6a00]" strokeWidth={2.25} aria-hidden />
          Checklist document history
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {storeName} · {loading ? "Loading…" : `${history.length} record${history.length === 1 ? "" : "s"}`}
          {" · "}
          <Link
            href={`/site-assessments?store=${encodeURIComponent(storeName)}`}
            className="font-semibold text-[#ff6a00] hover:underline"
          >
            Fill in daily checklist
          </Link>
        </p>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">Loading checklist history…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Completed by</th>
                <th className="px-4 py-3 text-left font-semibold">Score</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No checklist records for {storeName} yet.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{formatCheckDate(row.check_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.completed_by || "—"}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                      {row.score != null ? `${Math.round(Number(row.score))}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {String(row.status).toUpperCase() === CHECKLIST_STATUSES.COMPLETED ? (
                        <button
                          type="button"
                          onClick={() => handleViewPdf(row)}
                          className="text-xs font-semibold text-[#ff6a00] hover:underline"
                        >
                          View PDF
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
