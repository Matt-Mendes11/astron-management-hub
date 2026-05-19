import { read } from "./siteAssessments";

export const ASSESSMENT_PASS_SCORE = 75;
export const ASSESSMENT_ALERT_SCORE = 70;

export function isAssessmentPass(score) {
  return Number(score) > ASSESSMENT_PASS_SCORE;
}

export function isAssessmentLowScore(score) {
  const n = Number(score);
  return Number.isFinite(n) && n < ASSESSMENT_ALERT_SCORE;
}

export function parseAssessmentAnswers(record) {
  const raw = read(record, ["answers"], null);
  if (!raw || typeof raw !== "object") {
    return {
      meta: {
        label: read(record, ["assessment_type"], "Assessment"),
        subjectName: "—",
        assessor: read(record, ["assessor_name", "assessor"], "—"),
        assessmentDate: "",
        score: Number(read(record, ["score"], 0)),
        result: "—",
      },
      rows: [],
    };
  }

  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  const values = Array.isArray(raw.values) ? raw.values : [];
  const remediationItems = Array.isArray(raw.remediationItems) ? raw.remediationItems : [];

  const remediationByIndex = {};
  for (const item of remediationItems) {
    if (item?.index != null) remediationByIndex[item.index] = item.question;
  }

  const rows = questions.map((question, i) => {
    const index = i + 1;
    const answer = values[i];
    return {
      index,
      question,
      answer,
      isYes: answer === true,
      isNo: answer === false,
      remediation:
        answer === false
          ? remediationItems.find((r) => r.index === index)?.question || "Remediation required"
          : null,
    };
  });

  return {
    meta: {
      label: raw.assessmentLabel || read(record, ["assessment_type"], "Assessment"),
      subjectName: raw.subjectName || "—",
      assessor: read(record, ["assessor_name", "assessor"], "—"),
      assessmentDate: raw.assessmentDate || "",
      score: Number(read(record, ["score"], raw.yesCount != null ? 0 : 0)),
      result: raw.result || "—",
      yesCount: raw.yesCount,
      noCount: raw.noCount,
    },
    rows,
  };
}

export function resolveStaffProfileLink(record, staffProfiles, storeName) {
  const staffId = read(record, ["staff_id"], "");
  const name = parseAssessmentAnswers(record).meta.subjectName;

  if (staffId) {
    return {
      href: `/staff-management/${staffId}?store=${encodeURIComponent(storeName)}`,
      name: name !== "—" ? name : "View staff file",
    };
  }

  if (name && name !== "—") {
    const match = staffProfiles.find((s) => s.full_name.trim().toLowerCase() === name.trim().toLowerCase());
    if (match) {
      return {
        href: `/staff-management/${match.id}?store=${encodeURIComponent(storeName)}`,
        name: match.full_name,
      };
    }
  }

  return null;
}

export function printAssessmentReport({ record, storeName }) {
  const { meta, rows } = parseAssessmentAnswers(record);
  const score = Math.round(Number(meta.score) || 0);
  const dateLabel = record.created_at
    ? new Date(record.created_at).toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : meta.assessmentDate || "—";

  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;width:28px">${r.index}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#0f172a">${escapeHtml(r.question)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:700;color:${r.isYes ? "#15803d" : "#b91c1c"}">${r.isYes ? "Yes" : r.isNo ? "No" : "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569">${r.isNo && r.remediation ? escapeHtml(r.remediation) : "—"}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Assessment — ${escapeHtml(storeName)}</title>
<style>@media print { body { margin: 12mm; } } body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; max-width: 900px; margin: 0 auto; }</style></head><body>
<div style="border-bottom:4px solid #ff6a00;padding-bottom:12px;margin-bottom:20px">
<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.2em;color:#311162">ASTRON ENERGY</p>
<h1 style="margin:6px 0 0;font-size:22px;color:#311162">Site Assessment Report</h1>
<p style="margin:6px 0 0;font-size:14px;color:#64748b">${escapeHtml(storeName)} · ${escapeHtml(dateLabel)}</p>
</div>
<div style="display:flex;gap:24px;margin-bottom:20px;flex-wrap:wrap">
<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Type</span><p style="margin:4px 0 0;font-weight:600">${escapeHtml(meta.label)}</p></div>
<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Subject</span><p style="margin:4px 0 0;font-weight:600">${escapeHtml(meta.subjectName)}</p></div>
<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Assessor</span><p style="margin:4px 0 0">${escapeHtml(meta.assessor)}</p></div>
<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Score</span><p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#311162">${score}%</p></div>
<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Result</span><p style="margin:4px 0 0;font-weight:700">${escapeHtml(meta.result)}</p></div>
</div>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr style="background:#f8fafc">
<th style="padding:8px;text-align:left;color:#64748b">#</th>
<th style="padding:8px;text-align:left;color:#64748b">Question</th>
<th style="padding:8px;text-align:left;color:#64748b">Answer</th>
<th style="padding:8px;text-align:left;color:#64748b">Remediation</th>
</tr></thead><tbody>${rowsHtml || "<tr><td colspan='4'>No questions recorded</td></tr>"}</tbody></table>
<p style="margin-top:32px;font-size:11px;color:#94a3b8">Confidential — ${escapeHtml(storeName)} · Printed ${new Date().toLocaleString("en-ZA")}</p>
</body></html>`;

  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
