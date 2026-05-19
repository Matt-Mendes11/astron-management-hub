"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Shield, Upload } from "lucide-react";
import {
  STAFF_DOCUMENT_ACCEPT,
  STAFF_DOCUMENT_BUCKET,
  STAFF_DOCUMENTS_SETUP_HINT,
  isStaffDocumentsSchemaError,
  uploadStaffDocument,
} from "../../lib/staff";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-ZA");
};

export default function StaffDocumentVault({ supabase, staffId, storeName }) {
  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    setError("");
    setSchemaMissing(false);
    const { data, error: qErr } = await supabase
      .from("staff_documents")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("staff_id", staffId)
      .order("uploaded_at", { ascending: false });

    if (qErr) {
      if (isStaffDocumentsSchemaError(qErr.message)) {
        setSchemaMissing(true);
        setError("");
      } else {
        setError(qErr.message);
      }
      setDocuments([]);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, [supabase, staffId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !staffId) return;

    if (schemaMissing) {
      alert(`Document vault is not set up yet. ${STAFF_DOCUMENTS_SETUP_HINT}`);
      return;
    }

    setUploading(true);
    setError("");
    const result = await uploadStaffDocument(supabase, { staffId, storeName, file });
    setUploading(false);

    if (!result.ok) {
      if (isStaffDocumentsSchemaError(result.error)) {
        setSchemaMissing(true);
      } else {
        setError(result.error);
        alert(result.error);
      }
      return;
    }
    await loadDocuments();
  };

  const handleDownload = async (doc) => {
    const { data, error: dlErr } = await supabase.storage.from(STAFF_DOCUMENT_BUCKET).download(doc.storage_path);
    if (dlErr || !data) {
      alert(dlErr?.message || "Download failed.");
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.file_name || "document";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-5 shadow-inner ring-1 ring-sky-100">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#311162] text-white shadow-md shadow-[#311162]/25">
          <Shield className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900">Employee Document Vault</h3>
          <p className="mt-0.5 text-xs text-slate-600">Secure HR files — IDs, contracts, certifications</p>
        </div>
      </div>

      {schemaMissing ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
          <p className="font-bold">Document vault database not set up</p>
          <p className="mt-2">{STAFF_DOCUMENTS_SETUP_HINT}</p>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept={STAFF_DOCUMENT_ACCEPT}
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/80 bg-white px-4 py-3 text-sm font-bold text-[#311162] shadow-sm transition hover:border-[#311162]/30 hover:bg-sky-50/80 disabled:opacity-60 sm:w-auto"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
              {uploading ? "Uploading…" : "Upload document"}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              🔒 All documents are stored securely in the encrypted cloud vault linked to the{" "}
              <span className="font-semibold text-slate-800">{storeName}</span> branch.
            </p>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          <div className="mt-5 border-t border-sky-100/80 pt-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading documents…</p>
            ) : documents.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-sky-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                <FileText className="h-5 w-5 shrink-0 text-sky-400" strokeWidth={2} />
                <span>No documents uploaded yet.</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-xl border border-sky-100 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{doc.file_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Uploaded {formatDate(doc.uploaded_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#311162]/20 bg-[#311162]/5 px-3 py-2 text-xs font-bold text-[#311162] transition hover:bg-[#311162]/10"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
