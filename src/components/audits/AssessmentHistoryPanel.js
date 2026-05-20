"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { assessmentSubjectDisplay, read, todayStr } from "../../lib/siteAssessments";
import { supabase } from "../../lib/supabaseBrowser";
import { labelToSlug } from "../../lib/stores";
import { isAssessmentLowScore, resolveStaffProfileLink } from "../../lib/assessmentReport";
import AssessmentReportModal from "./AssessmentReportModal";

export default function AssessmentHistoryPanel({ storeName }) {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("site_assessments")
        .select("*")
        .eq("store_name", storeName)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (!error) setAssessments(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <History className="h-4 w-4 text-[#ff6a00]" strokeWidth={2.25} aria-hidden />
            Assessment history
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {storeName} · {loading ? "Loading…" : `${assessments.length} audit${assessments.length === 1 ? "" : "s"}`}
            {" · "}
            <Link
              href={`/${labelToSlug(storeName)}/routines-and-audits/site-assessments`}
              className="font-semibold text-[#ff6a00] hover:underline"
            >
              Run new assessment
            </Link>
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Loading assessment history…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Score</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {assessments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No audits for {storeName} yet.
                    </td>
                  </tr>
                ) : (
                  assessments.slice(0, 50).map((record) => {
                    const score = Number(read(record, ["score"], 0));
                    const staffLink = resolveStaffProfileLink(record, staffProfiles, storeName);
                    const subjectLabel = assessmentSubjectDisplay(record);

                    return (
                      <tr key={record.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          {new Date(read(record, ["created_at"], todayStr())).toLocaleDateString("en-ZA")}
                        </td>
                        <td className="px-4 py-3">{read(record, ["assessment_type"], "—")}</td>
                        <td className="px-4 py-3">
                          {staffLink ? (
                            <Link
                              href={staffLink.href}
                              className="font-medium text-[#ff6a00] hover:underline"
                            >
                              {staffLink.name || subjectLabel}
                            </Link>
                          ) : (
                            subjectLabel
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 font-bold ${
                            isAssessmentLowScore(score) ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {score}%
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setViewRecord(record)}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssessmentReportModal
        record={viewRecord}
        storeName={storeName}
        onClose={() => setViewRecord(null)}
      />
    </>
  );
}
