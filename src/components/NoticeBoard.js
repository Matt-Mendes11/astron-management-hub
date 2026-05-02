"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const DEFAULT_BRANCH = "Hillcrest";
const NOTICE_READER_KEY = "astron_notice_user_id";
const PRIORITY_STYLES = {
  low: "bg-sky-100 text-sky-700",
  normal: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};
const normalizeAttachmentUrl = (rawUrl) => {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  // Repair previously saved malformed links like "https://data:..."
  if (/^https?:\/\/(data:|blob:)/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, "");
  }
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};
const resolveAttachmentRawUrl = (attachment) => {
  if (typeof attachment === "string") return attachment;
  return (
    attachment?.url ||
    attachment?.link ||
    attachment?.href ||
    attachment?.path ||
    attachment?.file_url ||
    ""
  );
};
const pdfDataUrlToBlobUrl = (dataUrl) => {
  try {
    const match = String(dataUrl).match(/^data:application\/pdf;base64,(.+)$/i);
    if (!match) return "";
    const base64 = match[1].replace(/\s+/g, "");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
};
const resolveAttachmentUrl = (attachment) => {
  const raw = resolveAttachmentRawUrl(attachment);
  // Legacy notices may contain pure PDF base64 payload without data prefix.
  if (/^JVBERi0/i.test(String(raw).trim())) {
    const blobUrl = pdfDataUrlToBlobUrl(`data:application/pdf;base64,${String(raw).trim()}`);
    if (blobUrl) return blobUrl;
  }

  const normalized = normalizeAttachmentUrl(raw);
  if (!normalized) return "";
  if (/^data:application\/pdf;base64,/i.test(normalized)) {
    const blobUrl = pdfDataUrlToBlobUrl(normalized);
    if (blobUrl) return blobUrl;
  }
  if (/^(data:|blob:)/i.test(normalized)) return normalized;
  try {
    return encodeURI(normalized);
  } catch {
    return normalized;
  }
};
const canOpenAttachment = (attachment) => Boolean(resolveAttachmentUrl(attachment));
const getAttachmentType = (attachment) => {
  const rawUrl = String(resolveAttachmentRawUrl(attachment) || "").toLowerCase();
  const explicitType = String(attachment?.type || "").toLowerCase();
  if (explicitType === "pdf" || rawUrl.includes(".pdf") || rawUrl.startsWith("data:application/pdf")) {
    return "pdf";
  }
  return "link";
};
const getNoticeUserId = () => {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(NOTICE_READER_KEY);
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() || `user-${Date.now()}`;
    window.localStorage.setItem(NOTICE_READER_KEY, generated);
    return generated;
  } catch {
    return `user-${Date.now()}`;
  }
};
/** Inline **bold** within a single line or chunk (no newlines required). */
const parseInlineMarkdown = (line) => {
  const parts = String(line).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

/**
 * Detects http(s) and www. URLs; renders links with security attrs.
 * Newlines preserved by wrapping parent with whitespace-pre-wrap.
 */
const URL_TOKEN_SPLIT = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

const stripUrlTrailingPunct = (url) => url.replace(/[.,;:!?)'"\]]+$/g, "");

const linkifyContentMemo = (content) => {
  const raw = String(content ?? "");
  const tokens = raw.split(URL_TOKEN_SPLIT);
  return tokens.map((token, i) => {
    const trimmed = /^https?:\/\//i.test(token) || /^www\./i.test(token) ? stripUrlTrailingPunct(token) : token;
    if (/^https?:\/\//i.test(trimmed)) {
      return (
        <a
          key={`url-${i}`}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-sans font-semibold text-[#185FA5] underline decoration-[#185FA5]/45 underline-offset-[3px] hover:text-[#124a80]"
        >
          {trimmed}
        </a>
      );
    }
    if (/^www\./i.test(trimmed)) {
      const href = `https://${trimmed}`;
      return (
        <a
          key={`www-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-sans font-semibold text-[#185FA5] underline decoration-[#185FA5]/45 underline-offset-[3px] hover:text-[#124a80]"
        >
          {trimmed}
        </a>
      );
    }
    return (
      <span key={`txt-${i}`} className="inline">
        {parseInlineMarkdown(token)}
      </span>
    );
  });
};
const normalizeAttachments = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export default function NoticeBoard() {
  const searchParams = useSearchParams();
  const selectedBranch = searchParams.get("store") || DEFAULT_BRANCH;
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      const { data, error } = await supabase
        .from("notices")
        .select("id,title,content,priority,branch_id,author_name,attachments,created_at,pinned")
        .eq("branch_id", selectedBranch)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        setNotices([]);
        setLoading(false);
        return;
      }

      setNotices(data || []);
      setLoading(false);
    }

    fetchNotices();
  }, [selectedBranch]);

  const hasNotices = notices.length > 0;

  const noticeCountLabel = useMemo(
    () => `${notices.length} notice${notices.length === 1 ? "" : "s"}`,
    [notices.length]
  );

  const printNotice = (notice) => {
    if (!notice) return;
    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>Print Notice</title>
          <style>
            @media print {
              body { margin: 0; }
            }
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; background: #ffffff; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            .meta { color: #4b5563; margin-bottom: 20px; font-size: 13px; }
            .content { white-space: pre-wrap; line-height: 1.6; margin-bottom: 0; }
          </style>
        </head>
        <body>
          <h1>${notice.title || "Notice"}</h1>
          <div class="meta">Author: ${notice.author_name || "-"} | Branch: ${notice.branch_id || "-"}</div>
          <div class="content">${notice.content || ""}</div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  };
  const markNoticeAsRead = async (noticeId) => {
    const userId = getNoticeUserId();
    if (!noticeId || !userId) return;
    setMarkingRead(true);
    const { error } = await supabase
      .from("notice_reads")
      .upsert(
        { notice_id: noticeId, user_id: userId, read_at: new Date().toISOString() },
        { onConflict: "notice_id,user_id" }
      );
    if (error) {
      alert(error.message || "Failed to mark as read.");
      setMarkingRead(false);
      return;
    }
    setMarkingRead(false);
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Branch Notice Board</h3>
            <p className="text-xs text-slate-500">
              {selectedBranch} • {loading ? "Loading..." : noticeCountLabel}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Command Center
          </span>
        </div>
        {!loading && !hasNotices ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            No notices for this branch yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notices.map((notice) => {
              const priority = String(notice.priority || "normal").toLowerCase();
              return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => setSelectedNotice(notice)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal
                        }`}
                      >
                        {priority === "high" ? "High Priority" : priority}
                      </span>
                      {notice.pinned ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          📌 Pinned
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(notice.created_at).toLocaleDateString("en-ZA")}
                    </span>
                  </div>
                  <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {notice.title || "Notice"}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{notice.content}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedNotice ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-100">
            {/* Memo header */}
            <div className="border-b border-[#311162]/15 bg-gradient-to-r from-[#faf9fc] to-white px-8 pb-6 pt-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#311162]/70">
                    Internal notice
                  </p>
                  <h4 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {selectedNotice.title || "Notice"}
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>
                      <span className="font-semibold text-slate-700">Branch:</span> {selectedNotice.branch_id}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-700">From:</span>{" "}
                      {selectedNotice.author_name || "Unknown author"}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-700">Date:</span>{" "}
                      <time dateTime={selectedNotice.created_at}>
                        {new Date(selectedNotice.created_at).toLocaleString("en-ZA", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </time>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotice(null)}
                  className="shrink-0 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
              <div className="rounded-xl border border-slate-200/90 bg-[#fafaf9] px-8 py-9 shadow-inner">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Message</p>
                <div className="whitespace-pre-wrap break-words font-serif text-[17px] leading-[1.75] text-slate-800">
                  {linkifyContentMemo(selectedNotice.content)}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/80 px-8 py-6">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Attachments
              </p>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(selectedNotice.attachments)
                  ? selectedNotice.attachments
                  : normalizeAttachments(selectedNotice.attachments)
                ).map((attachment, index) => (
                  <button
                    key={`${attachment.url}-${index}`}
                    type="button"
                    onClick={() => {
                      const url = resolveAttachmentUrl(attachment);
                      if (!url) return;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    disabled={!canOpenAttachment(attachment)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {getAttachmentType(attachment) === "pdf" ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 3h7l5 5v13H7z" />
                        <path d="M14 3v5h5" />
                        <path d="M10 16h4" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10 6" />
                        <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.1a5 5 0 0 0 7.07 7.07L14 18" />
                      </svg>
                    )}
                    {attachment.label || attachment.name || "Attachment"}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200/80 pt-6">
                <button
                  type="button"
                  onClick={() => markNoticeAsRead(selectedNotice.id)}
                  disabled={markingRead}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markingRead ? "Saving…" : "Mark as read"}
                </button>
                <button
                  type="button"
                  onClick={() => printNotice(selectedNotice)}
                  className="rounded-xl border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Print notice
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}