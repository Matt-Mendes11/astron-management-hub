import { ASSESSMENT_TYPES } from "./siteAssessments";

export const ASSESSMENT_TEMPLATE_SETUP_HINT =
  "Run supabase/migrations/20260521120000_assessment_question_templates.sql in the Supabase SQL Editor, then reload the API schema.";

export function isAssessmentTemplateSchemaError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("assessment_question_templates") ||
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    (m.includes("relation") && m.includes("does not exist"))
  );
}

/** Seed default questions for a store + assessment type when none exist. */
export async function seedAssessmentTemplatesIfEmpty(supabase, storeName, assessmentKey) {
  const typeDef = ASSESSMENT_TYPES[assessmentKey];
  if (!typeDef) return { ok: false, error: "Unknown assessment type." };

  const { count, error: countErr } = await supabase
    .from("assessment_question_templates")
    .select("id", { count: "exact", head: true })
    .eq("store_name", storeName)
    .eq("assessment_key", assessmentKey);

  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) return { ok: true, seeded: false };

  const rows = typeDef.questions.map((question_text, index) => ({
    store_name: storeName,
    assessment_key: assessmentKey,
    question_text,
    sort_order: index,
    is_active: true,
  }));

  const { error } = await supabase.from("assessment_question_templates").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, seeded: true };
}

export async function fetchActiveAssessmentTemplates(supabase, storeName, assessmentKey) {
  return supabase
    .from("assessment_question_templates")
    .select("id, store_name, assessment_key, question_text, sort_order, is_active")
    .eq("store_name", storeName)
    .eq("assessment_key", assessmentKey)
    .eq("is_active", true)
    .order("sort_order");
}

export async function fetchAllAssessmentTemplates(supabase, storeName, assessmentKey) {
  return supabase
    .from("assessment_question_templates")
    .select("id, store_name, assessment_key, question_text, sort_order, is_active")
    .eq("store_name", storeName)
    .eq("assessment_key", assessmentKey)
    .order("sort_order");
}
