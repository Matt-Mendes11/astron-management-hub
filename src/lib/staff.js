export const POSITION_OPTIONS = ["Forecourt", "Shop", "Admin", "Manager"];

export const TRAINING_STATUS_OPTIONS = ["Pending", "In Progress", "Certified"];

export const STAFF_DOCUMENT_BUCKET = "staff-documents";

export const STAFF_DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/gif";

export const defaultStaffForm = () => ({
  full_name: "",
  position: "Forecourt",
  employee_id: "",
  contact_number: "",
  joined_date: "",
  id_number: "",
  date_of_birth: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  home_address: "",
  training_status: "Pending",
});

export function profileToForm(profile) {
  if (!profile) return defaultStaffForm();
  return {
    full_name: profile.full_name || "",
    position: profile.position || "Forecourt",
    employee_id: profile.employee_id || "",
    contact_number: profile.contact_number || "",
    joined_date: profile.joined_date || "",
    id_number: profile.id_number || "",
    date_of_birth: profile.date_of_birth || "",
    emergency_contact_name: profile.emergency_contact_name || "",
    emergency_contact_phone: profile.emergency_contact_phone || "",
    home_address: profile.home_address || "",
    training_status: profile.training_status || "Pending",
  };
}

export function formToStaffPayload(form, storeName) {
  return {
    store_name: storeName,
    full_name: form.full_name.trim(),
    position: form.position || null,
    employee_id: form.employee_id.trim() || null,
    contact_number: form.contact_number.trim() || null,
    joined_date: form.joined_date || null,
    id_number: form.id_number.trim() || null,
    date_of_birth: form.date_of_birth || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    home_address: form.home_address.trim() || null,
    training_status: form.training_status || "Pending",
  };
}

export function trainingStatusStyles(status) {
  const s = (status || "Pending").toLowerCase();
  if (s === "certified") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200/80";
  }
  if (s === "in progress") {
    return "bg-amber-100 text-amber-900 ring-amber-200/80";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200/80";
}

export function sanitizeStorageFileName(name) {
  return (name || "document")
    .replace(/[^\w.\-()+\s]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export const STAFF_DOCUMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isStaffDocumentsSchemaError(message) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("staff_documents") &&
    (m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find"))
  );
}

export const STAFF_DOCUMENTS_SETUP_HINT =
  "Run supabase/migrations/20260518120000_staff_profiles_documents.sql in the Supabase SQL Editor, then reload the API schema (Settings → API → Reload schema).";

/** Upload one staff document to storage and staff_documents. Returns { ok, error }. */
export async function uploadStaffDocument(supabase, { staffId, storeName, file }) {
  if (!staffId || !file) {
    return { ok: false, error: "Missing staff member or file." };
  }
  if (!STAFF_DOCUMENT_ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Please upload a PDF or image (JPEG, PNG, WebP, or GIF)." };
  }

  const safeName = sanitizeStorageFileName(file.name);
  const storagePath = `${storeName}/${staffId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from(STAFF_DOCUMENT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (upErr) {
    return { ok: false, error: upErr.message || "Upload failed." };
  }

  const { error: insErr } = await supabase.from("staff_documents").insert({
    staff_id: staffId,
    store_name: storeName,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
  });

  if (insErr) {
    await supabase.storage.from(STAFF_DOCUMENT_BUCKET).remove([storagePath]);
    return { ok: false, error: insErr.message || "Could not save document record." };
  }

  return { ok: true };
}

/** Remove staff profile, vault files, and unlink assessments. */
export async function deleteStaffMember(supabase, { staffId, storeName }) {
  if (!staffId || !storeName) {
    return { ok: false, error: "Missing staff member or store." };
  }

  const { data: docs, error: docsErr } = await supabase
    .from("staff_documents")
    .select("storage_path")
    .eq("staff_id", staffId);

  if (docsErr && !isStaffDocumentsSchemaError(docsErr.message)) {
    return { ok: false, error: docsErr.message || "Could not load documents." };
  }

  const paths = (docs || []).map((d) => d.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageErr } = await supabase.storage.from(STAFF_DOCUMENT_BUCKET).remove(paths);
    if (storageErr) {
      return { ok: false, error: storageErr.message || "Could not remove uploaded files." };
    }
  }

  await supabase.from("site_assessments").update({ staff_id: null }).eq("staff_id", staffId);

  const { error: delErr } = await supabase
    .from("staff_profiles")
    .delete()
    .eq("id", staffId)
    .eq("store_name", storeName);

  if (delErr) {
    return { ok: false, error: delErr.message || "Could not delete staff member." };
  }

  return { ok: true };
}
