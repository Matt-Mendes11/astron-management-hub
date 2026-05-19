import { categoryLabel, formatCheckDate } from "./dailyChecklist";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printChecklistReport({ checklist, responses, storeName }) {
  const score = checklist.score != null ? `${Math.round(Number(checklist.score))}%` : "—";
  const status = checklist.status || "—";
  const dateLabel = formatCheckDate(checklist.check_date);

  const byCategory = {};
  for (const r of responses) {
    const cat = r.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  const sectionsHtml = Object.entries(byCategory)
    .map(([cat, items]) => {
      const rows = items
        .map(
          (item, i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#475569;width:28px">${i + 1}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#0f172a">${escapeHtml(item.question_text)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:700;color:${item.answer ? "#15803d" : "#b91c1c"}">${item.answer ? "Yes" : "No"}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px">${item.answer === false && item.remediation_note ? escapeHtml(item.remediation_note) : "—"}</td>
        </tr>`
        )
        .join("");
      return `
        <h3 style="margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#311162">${escapeHtml(categoryLabel(cat))}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px;text-align:left;color:#64748b">#</th>
              <th style="padding:8px;text-align:left;color:#64748b">Question</th>
              <th style="padding:8px;text-align:left;color:#64748b">Answer</th>
              <th style="padding:8px;text-align:left;color:#64748b">Remediation</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  let metaHtml = `
    <div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Score</span><p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#311162">${score}</p></div>
    <div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Status</span><p style="margin:4px 0 0;font-size:16px;font-weight:700">${escapeHtml(status)}</p></div>`;
  if (checklist.completed_by) {
    metaHtml += `<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Completed by</span><p style="margin:4px 0 0;font-size:14px;font-weight:600">${escapeHtml(checklist.completed_by)}</p></div>`;
  }
  if (checklist.completed_at) {
    metaHtml += `<div><span style="font-size:11px;color:#64748b;text-transform:uppercase">Completed at</span><p style="margin:4px 0 0;font-size:14px">${new Date(checklist.completed_at).toLocaleString("en-ZA")}</p></div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Daily Checklist — ${escapeHtml(storeName)}</title>
<style>@media print { body { margin: 12mm; } } body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; max-width: 900px; margin: 0 auto; }</style></head><body>
<div style="border-bottom:4px solid #ff6a00;padding-bottom:12px;margin-bottom:20px">
<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.2em;color:#311162">ASTRON ENERGY</p>
<h1 style="margin:6px 0 0;font-size:22px;color:#311162">Daily Operational Checklist</h1>
<p style="margin:6px 0 0;font-size:14px;color:#64748b">${escapeHtml(storeName)} · ${escapeHtml(dateLabel)}</p></div>
<div style="display:flex;gap:24px;margin-bottom:20px;flex-wrap:wrap">${metaHtml}</div>
${sectionsHtml || "<p>No responses recorded.</p>"}
<p style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Confidential — ${escapeHtml(storeName)} · Printed ${new Date().toLocaleString("en-ZA")}</p>
</body></html>`;

  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
