"use client";

import { useRef } from "react";
import { FileText, Shield, X } from "lucide-react";
import { STAFF_DOCUMENT_ACCEPT } from "../../lib/staff";

/**
 * Optional ID / document picker for create-profile flows (before staff id exists).
 */
export default function StaffIdDocumentField({ file, onFileChange, storeName, disabled }) {
  const inputRef = useRef(null);

  return (
    <section className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white p-4 ring-1 ring-sky-100">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#311162] text-white">
          <Shield className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">ID copy (optional)</p>
          <p className="mt-0.5 text-xs text-slate-600">
            PDF or photo — saved to the document vault when the profile is created
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={STAFF_DOCUMENT_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-300/80 bg-white px-3 py-2 text-xs font-bold text-[#311162] shadow-sm transition hover:bg-sky-50/80 disabled:opacity-60"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2.25} />
          {file ? "Change file" : "Choose ID document"}
        </button>
        {file ? (
          <>
            <span className="max-w-[200px] truncate text-xs font-medium text-slate-700 sm:max-w-xs">{file.name}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onFileChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
              aria-label="Remove selected file"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        🔒 Stored in the encrypted cloud vault for the{" "}
        <span className="font-semibold text-slate-800">{storeName}</span> branch.
      </p>
    </section>
  );
}
