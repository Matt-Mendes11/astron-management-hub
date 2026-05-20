import {
  CHECKLIST_STATUSES,
  DEFAULT_TEMPLATE_QUESTIONS,
  todayDateKey,
  yesterdayDateKey,
} from "./dailyChecklist";

/** Seed default templates for a store if none exist. */
export async function seedTemplatesIfEmpty(supabase, storeName) {
  const { count, error: countErr } = await supabase
    .from("checklist_question_templates")
    .select("id", { count: "exact", head: true })
    .eq("store_name", storeName);

  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) return { ok: true, seeded: false };

  const rows = [];
  for (const [category, questions] of Object.entries(DEFAULT_TEMPLATE_QUESTIONS)) {
    questions.forEach((question_text, index) => {
      rows.push({
        store_name: storeName,
        category,
        question_text,
        sort_order: index,
        is_active: true,
      });
    });
  }

  const { error } = await supabase.from("checklist_question_templates").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, seeded: true };
}

/** Ensure today exists (Pending) and mark yesterday Pending → OVERDUE. */
export async function syncDailyChecklistLifecycle(supabase, storeName) {
  const today = todayDateKey();
  const yesterday = yesterdayDateKey();

  const { data: yesterdayRow } = await supabase
    .from("daily_checklists")
    .select("id, status")
    .eq("store_name", storeName)
    .eq("check_date", yesterday)
    .maybeSingle();

  let yesterdayOverdue = false;
  if (yesterdayRow) {
    const yStatus = String(yesterdayRow.status || "");
    if (yStatus === CHECKLIST_STATUSES.PENDING) {
      await supabase
        .from("daily_checklists")
        .update({ status: CHECKLIST_STATUSES.OVERDUE })
        .eq("id", yesterdayRow.id);
      yesterdayOverdue = true;
    } else if (yStatus.toUpperCase() === CHECKLIST_STATUSES.OVERDUE) {
      yesterdayOverdue = true;
    }
  }

  const { data: todayRow } = await supabase
    .from("daily_checklists")
    .select("id, status, check_date, score, completed_at")
    .eq("store_name", storeName)
    .eq("check_date", today)
    .maybeSingle();

  if (!todayRow) {
    const { data: created, error } = await supabase
      .from("daily_checklists")
      .insert({
        store_name: storeName,
        check_date: today,
        status: CHECKLIST_STATUSES.PENDING,
        deadline_time: "12:00:00",
      })
      .select("id, status, check_date, score, completed_at")
      .single();
    if (error) {
      if (error.code === "23505" || String(error.message || "").includes("duplicate key value")) {
        const { data: existing, error: existingErr } = await supabase
          .from("daily_checklists")
          .select("id, status, check_date, score, completed_at")
          .eq("store_name", storeName)
          .eq("check_date", today)
          .maybeSingle();

        if (!existingErr && existing) return { ok: true, today: existing, yesterdayOverdue };
      }
      return { ok: false, error: error.message, today: null, yesterdayOverdue };
    }
    return { ok: true, today: created, yesterdayOverdue };
  }

  return { ok: true, today: todayRow, yesterdayOverdue };
}

export async function fetchActiveTemplates(supabase, storeName) {
  return supabase
    .from("checklist_question_templates")
    .select("id, store_name, category, question_text, sort_order, is_active")
    .eq("store_name", storeName)
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
}

export async function fetchAllTemplates(supabase, storeName) {
  return supabase
    .from("checklist_question_templates")
    .select("id, store_name, category, question_text, sort_order, is_active")
    .eq("store_name", storeName)
    .order("category")
    .order("sort_order");
}

export async function fetchChecklistHistory(supabase, storeName, limit = 60) {
  return supabase
    .from("daily_checklists")
    .select("id, store_name, check_date, status, score, completed_at, completed_by")
    .eq("store_name", storeName)
    .order("check_date", { ascending: false })
    .limit(limit);
}

export async function fetchYesterdayChecklist(supabase, storeName) {
  return supabase
    .from("daily_checklists")
    .select("id, check_date, status, score, completed_at, completed_by")
    .eq("store_name", storeName)
    .eq("check_date", yesterdayDateKey())
    .maybeSingle();
}

export async function fetchChecklistResponses(supabase, checklistId) {
  return supabase
    .from("checklist_responses")
    .select("id, question_id, category, question_text, answer, remediation_note")
    .eq("checklist_id", checklistId)
    .order("category")
    .order("question_text");
}

export async function submitChecklistCompletion(supabase, { checklistId, storeName, responses, completedBy }) {
  const score = responses.length
    ? Math.round((responses.filter((r) => r.answer === true).length / responses.length) * 100)
    : 0;

  const { error: delErr } = await supabase.from("checklist_responses").delete().eq("checklist_id", checklistId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = responses.map((r) => ({
    checklist_id: checklistId,
    question_id: r.questionId || null,
    category: r.category,
    question_text: r.questionText,
    answer: r.answer,
    remediation_note: r.answer === false ? r.remediationNote?.trim() || null : null,
  }));

  const { error: insErr } = await supabase.from("checklist_responses").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  const { error: upErr } = await supabase
    .from("daily_checklists")
    .update({
      status: CHECKLIST_STATUSES.COMPLETED,
      score,
      completed_at: new Date().toISOString(),
      completed_by: completedBy?.trim() || null,
    })
    .eq("id", checklistId)
    .eq("store_name", storeName);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, score };
}
