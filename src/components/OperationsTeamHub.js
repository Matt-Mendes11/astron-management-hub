"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Megaphone, UsersRound } from "lucide-react";
import { labelToSlug } from "../lib/stores";
import { useAuthProfile } from "../lib/authProfile";
import AssessmentHistoryPanel from "./audits/AssessmentHistoryPanel";
import ChecklistDocumentHistoryPanel from "./audits/ChecklistDocumentHistoryPanel";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORE_OPTIONS = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];
const PRIORITY_OPTIONS = ["low", "normal", "high"];
const DEFAULT_BRANCH = "Hillcrest";

const emptyAttachment = () => ({ label: "", url: "" });
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
const normalizeAttachmentUrl = (rawUrl) => {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\/(data:|blob:)/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, "");
  }
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function OperationsTeamHub({ storeName, storeSlug }) {
  const searchParams = useSearchParams();
  const selectedBranch = storeName || searchParams.get("store") || DEFAULT_BRANCH;
  const activeStoreSlug = storeSlug || labelToSlug(selectedBranch);
  const { isManager } = useAuthProfile();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [readCounts, setReadCounts] = useState({});
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "normal",
    branch_id: selectedBranch,
    author_name: "",
    attachments: [emptyAttachment()],
  });

  useEffect(() => {
    let ignore = false;
    async function fetchNotices() {
      const { data, error: fetchError } = await supabase
        .from("notices")
        .select("id,title,content,priority,branch_id,author_name,attachments,created_at,pinned")
        .eq("branch_id", selectedBranch)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);

      if (ignore) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load notices.");
        setNotices([]);
        setLoading(false);
        return;
      }

      setError("");
      setNotices(data || []);
      const ids = (data || []).map((n) => n.id).filter(Boolean);
      if (ids.length) {
        const { data: reads } = await supabase
          .from("notice_reads")
          .select("notice_id")
          .in("notice_id", ids);
        if (!ignore) {
          const counts = {};
          (reads || []).forEach((row) => {
            counts[row.notice_id] = (counts[row.notice_id] || 0) + 1;
          });
          setReadCounts(counts);
        }
      } else if (!ignore) {
        setReadCounts({});
      }
      setLoading(false);
    }

    fetchNotices();
    return () => {
      ignore = true;
    };
  }, [selectedBranch]);

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      priority: "normal",
      branch_id: selectedBranch,
      author_name: "",
      attachments: [emptyAttachment()],
    });
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAttachment = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addAttachment = () => {
    setForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, emptyAttachment()],
    }));
  };

  const removeAttachment = (index) => {
    setForm((prev) => {
      const next = prev.attachments.filter((_, idx) => idx !== index);
      return { ...prev, attachments: next.length ? next : [emptyAttachment()] };
    });
  };

  const handlePdfUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      setForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments.filter((a) => a.label || a.url),
          { label: file.name.replace(/\.pdf$/i, ""), url: dataUrl },
        ],
      }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const submitNotice = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const author_name = form.author_name.trim();
    const priority = String(form.priority || "normal").toLowerCase();
    const branch_id = String(form.branch_id || selectedBranch || DEFAULT_BRANCH).trim();

    if (!title || !content || !author_name) {
      const message = "Title, content, and author name are required.";
      setError(message);
      alert(message);
      return;
    }

    if (!PRIORITY_OPTIONS.includes(priority)) {
      const message = "Priority must be low, normal, or high.";
      setError(message);
      alert(message);
      return;
    }

    const attachments = form.attachments
      .map((a) => ({
        label: String(a.label || "").trim(),
        url: normalizeAttachmentUrl(a.url),
        type: String(a.url || "").toLowerCase().includes(".pdf")
          ? "pdf"
          : String(a.url || "").toLowerCase().includes(".xlsx") ||
              String(a.url || "").toLowerCase().includes(".xls")
            ? "excel"
            : "link",
      }))
      .filter((a) => a.label && a.url);

    setSaving(true);
    setError("");

    const payload = {
      title,
      content,
      priority,
      branch_id,
      author_name,
      attachments,
      pinned: false,
    };

    const insertResult = await supabase.from("notices").insert(payload);
    if (insertResult.error) {
      setSaving(false);
      const message = insertResult.error.message || "Failed to post notice.";
      setError(message);
      alert(message);
      return;
    }

    resetForm();
    setIsModalOpen(false);
    const { data, error: refreshError } = await supabase
      .from("notices")
      .select("id,title,content,priority,branch_id,author_name,attachments,created_at,pinned")
      .eq("branch_id", selectedBranch)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    if (refreshError) {
      setError(refreshError.message || "Failed to refresh notices.");
      alert(refreshError.message || "Failed to refresh notices.");
    } else {
      setNotices(data || []);
      alert("Notice posted successfully.");
    }
    setSaving(false);
  };

  const deleteNotice = async (noticeId) => {
    const confirmed = window.confirm("Delete this notice?");
    if (!confirmed) return;
    setDeletingId(noticeId);
    const { error: deleteError } = await supabase
      .from("notices")
      .delete()
      .eq("id", noticeId)
      .eq("branch_id", selectedBranch);
    if (deleteError) {
      setError(deleteError.message || "Failed to delete notice.");
      setDeletingId("");
      return;
    }
    const { data, error: refreshError } = await supabase
      .from("notices")
      .select("id,title,content,priority,branch_id,author_name,attachments,created_at,pinned")
      .eq("branch_id", selectedBranch)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    if (refreshError) {
      setError(refreshError.message || "Deleted, but failed to refresh notices.");
      setNotices((prev) => prev.filter((notice) => notice.id !== noticeId));
    } else {
      setNotices(data || []);
    }
    setDeletingId("");
  };
  const togglePinNotice = async (notice) => {
    const { error: pinError } = await supabase
      .from("notices")
      .update({ pinned: !Boolean(notice.pinned) })
      .eq("id", notice.id)
      .eq("branch_id", selectedBranch);
    if (pinError) {
      setError(pinError.message || "Failed to update pin.");
      alert(pinError.message || "Failed to update pin.");
      return;
    }
    setNotices((prev) =>
      [...prev.map((n) => (n.id === notice.id ? { ...n, pinned: !Boolean(n.pinned) } : n))].sort(
        (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      )
    );
  };

  const noticeCount = useMemo(() => notices.length, [notices.length]);

  return (
    <div className="space-y-8">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Megaphone className="h-4 w-4 text-[#ff6a00]" strokeWidth={1.8} aria-hidden />
            Notice Board
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Announcements • {selectedBranch} • {loading ? "Loading..." : `${noticeCount} notices`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
        >
          + Post Notice
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          Loading notices...
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          No notices posted for this branch yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase text-slate-500">
                    {notice.priority}
                  </span>
                  {notice.pinned ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Pinned
                    </span>
                  ) : null}
                  <span className="text-[11px] text-slate-400">•</span>
                  <span className="text-[11px] text-slate-500">
                    {new Date(notice.created_at).toLocaleString("en-ZA")}
                  </span>
                </div>
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{notice.title}</p>
                <p className="line-clamp-2 text-xs text-slate-600">{notice.content}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Attachments: {normalizeAttachments(notice.attachments).length}</span>
                  <span>•</span>
                  <span>{readCounts[notice.id] || 0} reads</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => togglePinNotice(notice)}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm hover:bg-amber-50"
                >
                  {notice.pinned ? "Unpin" : "Pin"}
                </button>
                {isManager ? (
                  <button
                    type="button"
                    onClick={() => deleteNotice(notice.id)}
                    disabled={deletingId === notice.id}
                    className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === notice.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Post Manager Notice</h4>
                <p className="text-xs text-slate-500">Create a command-center announcement.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Author Name</span>
                <input
                  type="text"
                  value={form.author_name}
                  onChange={(e) => updateForm("author_name", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
                <select
                  value={form.priority}
                  onChange={(e) => updateForm("priority", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority[0].toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch Selector</span>
                <select
                  value={form.branch_id}
                  onChange={(e) => updateForm("branch_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                >
                  {STORE_OPTIONS.map((store) => (
                    <option key={store} value={store}>
                      {store}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Content
              </span>
              <textarea
                rows={4}
                value={form.content}
                onChange={(e) => updateForm("content", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
              />
            </label>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Attachments
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addAttachment}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Link
                  </button>
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    + PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                {form.attachments.map((attachment, index) => (
                  <div key={`attachment-${index}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                    <input
                      type="text"
                      placeholder="Label (e.g. Safety PDF)"
                      value={attachment.label}
                      onChange={(e) => updateAttachment(index, "label", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={attachment.url}
                      onChange={(e) => updateAttachment(index, "url", e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6e00]"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNotice}
                disabled={saving}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Posting..." : "Post Notice"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>

    <ChecklistDocumentHistoryPanel storeName={selectedBranch} />
    <AssessmentHistoryPanel storeName={selectedBranch} />

    {isManager ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <UsersRound className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">User access management</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Manage logins, roles, stores, and revoked access.
              </p>
            </div>
          </div>
          <Link
            href={`/${activeStoreSlug}/operations-team-hub/access-management`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#ff6e00]/50 hover:text-[#ff6e00]"
          >
            Open access management
          </Link>
        </div>
      </section>
    ) : null}
    </div>
  );
}
