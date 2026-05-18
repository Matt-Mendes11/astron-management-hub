"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import AppDrillBack from "../../components/drilldown/AppDrillBack";
import { labelToSlug } from "../../lib/stores";
import { ClipboardCheck, MessageCircle, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];
const DEADLINE_HOUR = 12;
const DEADLINE_MINUTE = 0;

const DAILY_CHECKLIST_CONFIG = {
  equipment: [
    "Retail dispensing pumps turned ON and fully functioning",
    "Payment24 Terminal is live and operational",
    "Driveway clean, well-maintained, free from litter / oil spills",
    "Forecourt well-lit (canopy lights, pole lights working)",
    "Shop and promotion signage correctly displayed",
    "Waste bins emptied, clean, not overflowing",
    "Fire extinguishers in place, unobstructed, seals intact",
    "First aid kit stocked and accessible",
    "Spill kit stocked and accessible",
    "Forecourt floor free of cracks/trip hazards",
    "No fuel leaks under / around pumps or tanks",
    "Safety signage visible",
    "Public restrooms clean, stocked, maintained",
    "Emergency contact numbers displayed at till",
  ],
  duties: [
    "Pump readings captured on handover sheet",
    "Cash-up / cash drop completed and signed",
    "Shift handover book signed by outgoing & incoming",
    "CCTV operational — no offline cameras",
    "Alarm / panic system tested",
    "All outgoing cash deposits logged",
    "Fuel stock sticks taken, reconciled with Infinity",
    "Fuel delivery notes filed (if delivery received)",
    "Site register up to date",
    "Incident / near-miss register reviewed",
    "Dip readings recorded",
    "Variance report reviewed (yesterday)",
    "Next shift briefed on outstanding items",
  ],
  ppe: [
    "Reflective vests worn by all forecourt staff",
    "Safety shoes worn by all on-site staff",
    "Name badges worn and visible",
    "Uniforms clean, presentable, compliant",
    "Gloves available at pumps",
    "Hand sanitiser available at till / pumps",
    "Eye-wash station unobstructed and functional",
    "Fire blanket in kitchen (FreshStop) accessible",
    "Kitchen staff wearing hairnets / hats where required",
    "Food-handler certificates displayed",
    "Slip-resistant mats at till / FreshStop counter",
    "Cleaning chemicals labelled & stored correctly",
    "MSDS sheets available on site",
  ],
  toolboxTopics: [
    "Fire safety & extinguisher use",
    "Spill response (fuel / chemical)",
    "Customer service standards",
    "Slip / trip / fall prevention",
    "Robbery & panic procedure",
    "Product knowledge (fuel grades, Quartech)",
    "FreshStop food hygiene",
    "Other",
  ],
};

const ASSESSMENT_TYPES = {
  csa_forecourt: {
    label: "CSA Forecourt Service",
    passThreshold: 14,
    questions: [
      "Waved the customer in and guided them to the most convenient pump?",
      "Welcome to Astron Energy (with a smile)",
      "Can I fill up your tank with Quartech petrol or diesel?",
      "Did the CSA confirm the amount and fuel type?",
      "Was the CSA able to explain what Quartech fuel is (if asked)?",
      "Discuss the forecourt and C-Store promotions",
      "Was the CSA able to correctly share the details of the promotions and answer the customer's questions?",
      "Can I check your oil, coolant, tyre pressure and clean your windscreen?",
      "Did the CSA confirm the amount and fuel type again just before dispensing fuel?",
      "Are you registered with Astron Energy Rewards?",
      "Is the CSA able to explain what the rewards program is and how to register?",
      "WhatsApp, USSD, Astron Energy App, Website, QR Code — registration methods known?",
      "How are you going to pay? Cash, Card, Ucount or Fleet card?",
      "Did the CSA use the Payment24 Terminal for this transaction?",
      "Thank you for choosing Astron Energy. Have a wonderful day (or any other parting remark)",
    ],
  },
  store_promotions: {
    label: "Store & Promotions",
    passThreshold: 19,
    questions: [
      "Was the shop clean and free from stains and litter?",
      "Was the shop free from safety hazards?",
      "Did the store team member greet you on entry?",
      "Was the store team member wearing an approved uniform?",
      "Was the store team member's uniform correct, clean, and in good condition?",
      "Did the team member offer you current store specials/promotions?",
      "Were promotional materials clearly displayed in store?",
      "Were forecourt promotions communicated to the customer?",
      "Could the team member explain promotion details when asked?",
      "Were products easy to find and shelves well stocked?",
      "Was product pricing clearly visible?",
      "Was the FreshStop food section stocked and presentable?",
      "Was the transaction completed with ease and timeliness?",
      "Was the customer offered a receipt?",
      "Did the store team member thank you and offer a parting remark?",
      "Was the FreshStop hot food counter clean and well maintained?",
      "Were cold drinks and refrigerated items properly stocked and at temperature?",
      "Was the shop well lit with clear aisle navigation?",
      "Did the team member suggest add-on items or upsell at the till?",
      "Were loyalty/rewards materials visible at the shop counter?",
    ],
  },
  driveway_appearance: {
    label: "Driveway Appearance",
    passThreshold: 19,
    questions: [
      "Is the site entrance clean, easy and clear?",
      "Is directional signage visible and in good condition?",
      "Is the forecourt free of debris and litter?",
      "Is fuel pricing signage visible and current?",
      "Is the forecourt well lit? (if applicable)",
      "Are the fuel pumps clean and in working order?",
      "Are the pump islands free of oil spills and stains?",
      "Are rubbish bins available and not overflowing?",
      "Is the canopy clean and free of damage?",
      "Are CSAs clearly visible in uniform on the forecourt?",
      "Are all visible staff dressed in correct, clean uniform?",
      "Is the customer restroom available and accessible?",
      "Is the restroom clean and stocked?",
      "Is the overall site appearance professional and inviting?",
      "Are safety signs and fire equipment visible and accessible?",
      "Is the payment area clean and organised?",
      "Are oil and lubricant displays stocked and tidy?",
      "Is the car wash area clean and operational?",
      "Are parking areas and walkways clear and well maintained?",
      "Is branded signage clean, visible and undamaged?",
    ],
  },
};
const ASSESSMENT_TYPE_DB_VALUE = {
  csa_forecourt: "Forecourt",
  store_promotions: "Store",
  driveway_appearance: "Driveway",
};

const todayStr = () => new Date().toISOString().split("T")[0];

const checklistAnswerState = () => ({
  equipment: Array(DAILY_CHECKLIST_CONFIG.equipment.length).fill(null),
  duties: Array(DAILY_CHECKLIST_CONFIG.duties.length).fill(null),
  ppe: Array(DAILY_CHECKLIST_CONFIG.ppe.length).fill(null),
});

const read = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] != null) return row[key];
  }
  return fallback;
};

const assessmentSubjectDisplay = (record) => {
  const ans = read(record, ["answers"], null);
  if (ans && typeof ans === "object" && ans.subjectName != null && String(ans.subjectName).trim()) {
    return String(ans.subjectName).trim();
  }
  return "—";
};

export default function SiteAssessmentsPage() {
  const searchParams = useSearchParams();
  const selectedStore = STORES.includes(searchParams.get("store")) ? searchParams.get("store") : "Hillcrest";
  const backHref = useMemo(() => {
    const r = searchParams.get("return");
    if (r) {
      try {
        return decodeURIComponent(r);
      } catch {
        return r;
      }
    }
    return `/${labelToSlug(selectedStore)}/routines-and-audits`;
  }, [searchParams, selectedStore]);

  const [activeTab, setActiveTab] = useState("daily");
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dailyRecords, setDailyRecords] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);

  const [checklistStore, setChecklistStore] = useState("");
  const [checklistFormOpen, setChecklistFormOpen] = useState(false);
  const [checklistAnswers, setChecklistAnswers] = useState(checklistAnswerState());
  const [checklistSupervisor, setChecklistSupervisor] = useState("");
  const [toolboxTopic, setToolboxTopic] = useState("");
  const [toolboxOther, setToolboxOther] = useState("");
  const [huddleNotes, setHuddleNotes] = useState("");
  const [signoffNotes, setSignoffNotes] = useState("");
  const [attendees, setAttendees] = useState([{ name: "", role: "" }]);

  const [assessmentType, setAssessmentType] = useState("csa_forecourt");
  const [assessmentSubject, setAssessmentSubject] = useState("");
  const [assessmentStaffId, setAssessmentStaffId] = useState("");
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [assessmentAssessor, setAssessmentAssessor] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayStr());
  const [assessmentAnswers, setAssessmentAnswers] = useState(
    Array(ASSESSMENT_TYPES.csa_forecourt.questions.length).fill(null)
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .eq("store_name", selectedStore)
        .order("full_name");
      if (!cancelled) setStaffProfiles(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStore]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const [dailyRes, assessmentsRes] = await Promise.all([
      supabase.from("daily_checklists").select("*").order("check_date", { ascending: false }),
      supabase.from("site_assessments").select("*").order("created_at", { ascending: false }),
    ]);
    if (dailyRes.error || assessmentsRes.error) {
      setError(dailyRes.error?.message || assessmentsRes.error?.message || "Failed to load data.");
      setLoading(false);
      return;
    }
    setDailyRecords(dailyRes.data || []);
    setAssessments(assessmentsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setAssessmentAnswers(Array(ASSESSMENT_TYPES[assessmentType].questions.length).fill(null));
  }, [assessmentType]);

  const deadlineMeta = (store) => {
    const record = dailyRecords.find(
      (row) =>
        String(read(row, ["store_name", "store"], "")) === store &&
        String(read(row, ["check_date"], "")) === todayStr()
    );
    const deadline = new Date(now);
    deadline.setHours(DEADLINE_HOUR, DEADLINE_MINUTE, 0, 0);
    const msDiff = deadline.getTime() - now.getTime();
    const overdue = msDiff < 0;
    const hours = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60)));
    const mins = Math.max(0, Math.floor((msDiff % (1000 * 60 * 60)) / (1000 * 60)));

    if (record) {
      const completedAt = read(record, ["completed_at"], "");
      const completedTime = completedAt
        ? new Date(completedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
        : "";
      return {
        status: String(read(record, ["status"], "Pending")).toLowerCase() === "completed" ? "Completed" : "Pending",
        meta: completedTime ? `Completed at ${completedTime}` : "Checklist submitted",
        record,
      };
    }
    if (overdue) return { status: "Overdue", meta: "Deadline passed at 12:00 PM", record: null };
    return { status: "Pending", meta: `Due in ${hours}h ${mins}m`, record: null };
  };

  const openChecklist = (store) => {
    setChecklistStore(store);
    setChecklistFormOpen(true);
    setChecklistAnswers(checklistAnswerState());
    setChecklistSupervisor("");
    setToolboxTopic("");
    setToolboxOther("");
    setHuddleNotes("");
    setSignoffNotes("");
    setAttendees([{ name: "", role: "" }]);
  };

  const setChecklistAnswer = (section, index, value) => {
    setChecklistAnswers((prev) => {
      const next = { ...prev };
      next[section] = [...next[section]];
      next[section][index] = value;
      return next;
    });
  };

  const submitChecklist = async () => {
    const allAnswered = ["equipment", "duties", "ppe"].every((section) =>
      checklistAnswers[section].every((value) => value !== null)
    );
    if (!allAnswered) {
      alert("Please complete all checklist questions.");
      return;
    }
    if (!checklistSupervisor.trim()) {
      alert("Supervisor is required.");
      return;
    }
    if (!toolboxTopic) {
      alert("Please select a toolbox topic.");
      return;
    }
    if (toolboxTopic === "Other" && !toolboxOther.trim()) {
      alert("Please specify the toolbox topic.");
      return;
    }
    const cleanAttendees = attendees.map((a) => ({
      name: a.name.trim(),
      role: a.role.trim(),
    })).filter((a) => a.name);
    if (!cleanAttendees.length) {
      alert("Please add at least one attendee.");
      return;
    }

    const completedAt = new Date().toISOString();
    const payload = {
      store_name: checklistStore,
      status: "Completed",
      completed_at: completedAt,
      check_date: todayStr(),
      deadline_time: "12:00:00",
    };

    const { error: insertError } = await supabase
      .from("daily_checklists")
      .upsert(payload, { onConflict: "store_name,check_date" });
    if (insertError) {
      alert(insertError.message || "Failed to submit checklist.");
      return;
    }
    setChecklistFormOpen(false);
    await loadData();
  };

  const totalChecklistItems = useMemo(
    () =>
      DAILY_CHECKLIST_CONFIG.equipment.length +
      DAILY_CHECKLIST_CONFIG.duties.length +
      DAILY_CHECKLIST_CONFIG.ppe.length,
    []
  );

  const assessmentQuestions = ASSESSMENT_TYPES[assessmentType].questions;
  const yesCount = useMemo(() => assessmentAnswers.filter((a) => a === true).length, [assessmentAnswers]);
  const noCount = useMemo(() => assessmentAnswers.filter((a) => a === false).length, [assessmentAnswers]);
  const allAssessmentAnswered = useMemo(
    () => assessmentAnswers.length > 0 && assessmentAnswers.every((answer) => answer !== null),
    [assessmentAnswers]
  );
  const scorePct = useMemo(
    () => Math.round((yesCount / Math.max(assessmentQuestions.length, 1)) * 100),
    [yesCount, assessmentQuestions.length]
  );
  const remediationItems = useMemo(
    () =>
      assessmentQuestions
        .map((question, index) => ({ question, index: index + 1, answer: assessmentAnswers[index] }))
        .filter((item) => item.answer === false),
    [assessmentAnswers, assessmentQuestions]
  );

  const submitAssessment = async () => {
    if (!assessmentSubject.trim() || !assessmentAssessor.trim()) {
      alert("Subject and Assessor are required.");
      return;
    }
    if (!allAssessmentAnswered) {
      alert("Please answer all assessment questions.");
      return;
    }

    const payload = {
      store_name: selectedStore,
      assessment_type: ASSESSMENT_TYPE_DB_VALUE[assessmentType] || "Forecourt",
      assessor_name: assessmentAssessor.trim(),
      score: scorePct,
      ...(assessmentStaffId ? { staff_id: assessmentStaffId } : {}),
      answers: {
        version: "v1",
        assessmentKey: assessmentType,
        assessmentLabel: ASSESSMENT_TYPES[assessmentType].label,
        assessmentDate,
        subjectName: assessmentSubject.trim(),
        questions: assessmentQuestions,
        values: assessmentAnswers,
        yesCount,
        noCount,
        remediationItems,
        passThreshold: ASSESSMENT_TYPES[assessmentType].passThreshold,
        result: yesCount >= ASSESSMENT_TYPES[assessmentType].passThreshold ? "Pass" : "Fail",
      },
    };

    const { error: insertError } = await supabase.from("site_assessments").insert(payload);
    if (insertError) {
      alert(insertError.message || "Failed to submit assessment.");
      return;
    }
    setAssessmentSubject("");
    setAssessmentStaffId("");
    setAssessmentAssessor("");
    setAssessmentAnswers(Array(assessmentQuestions.length).fill(null));
    await loadData();
  };

  const sendToSiteGroup = () => {
    if (!allAssessmentAnswered) {
      alert("Complete the assessment before sending.");
      return;
    }
    const failedList = remediationItems.length
      ? remediationItems.map((item) => `- Q${item.index}: ${item.question}`).join("\n")
      : "- None";
    const msg =
      `📋 Site Assessment — ${selectedStore}\n\n` +
      `Type: ${ASSESSMENT_TYPES[assessmentType].label}\n` +
      `Score: ${scorePct}%\n` +
      `Date: ${assessmentDate}\n\n` +
      `Remediations Required:\n${failedList}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const filteredAssessments = useMemo(
    () => assessments.filter((row) => String(read(row, ["store_name", "store"], "")) === selectedStore),
    [assessments, selectedStore]
  );

  const metrics = useMemo(() => {
    const total = filteredAssessments.length;
    const avgScore = total
      ? Math.round(
          filteredAssessments.reduce((sum, row) => sum + Number(read(row, ["score"], 0)), 0) / total
        )
      : 0;
    const passCount = filteredAssessments.filter((row) => Number(read(row, ["score"], 0)) >= 80).length;
    return { total, avgScore, passRate: total ? Math.round((passCount / total) * 100) : 0 };
  }, [filteredAssessments]);

  return (
    <div className="space-y-6">
      <AppDrillBack backHref={backHref} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Site Assessments & Daily Checklist</h2>
        <p className="text-sm text-slate-600">Astron quality, compliance, and remediation tracking</p>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <Tabs.List className="inline-flex w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <Tabs.Trigger
            value="daily"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Daily Checklist
          </Tabs.Trigger>
          <Tabs.Trigger
            value="assessments"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-[#ff6e00] data-[state=active]:text-white"
          >
            Assessments
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="daily" className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Daily Checklist Status</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STORES.map((store) => {
                const status = deadlineMeta(store);
                const isOverdue = status.status === "Overdue";
                return (
                  <div
                    key={store}
                    className={`rounded-xl border p-4 ${
                      isOverdue ? "border-red-300 bg-red-50/70" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{store}</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          status.status === "Completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : status.status === "Completed Late"
                            ? "bg-amber-100 text-amber-700"
                            : status.status === "Overdue"
                            ? "animate-pulse bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {status.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{status.meta}</p>
                    <div className="mt-3">
                      {status.record ? (
                        <button
                          type="button"
                          onClick={() => setViewRecord({ type: "daily", data: status.record })}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openChecklist(store)}
                          className="rounded-lg bg-[#ff6e00] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
                        >
                          Fill In
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="assessments" className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Score</p>
              <p className="mt-2 text-2xl font-bold text-[#311162]">{metrics.avgScore}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pass Rate</p>
              <p className="mt-2 text-2xl font-bold text-[#ff6a00]">{metrics.passRate}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Audits</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Deep Assessment</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment Type</span>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                >
                  {Object.entries(ASSESSMENT_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</span>
                <input
                  value={selectedStore}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
                <input
                  value={assessmentSubject}
                  onChange={(e) => setAssessmentSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Staff profile (optional)
                </span>
                <select
                  value={assessmentStaffId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAssessmentStaffId(v);
                    const person = staffProfiles.find((s) => s.id === v);
                    if (person) setAssessmentSubject(person.full_name);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                >
                  <option value="">Not linked</option>
                  {staffProfiles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessor</span>
                <input
                  value={assessmentAssessor}
                  onChange={(e) => setAssessmentAssessor(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                <input
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6e00]"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">
                Score: {scorePct}% ({yesCount}/{assessmentQuestions.length} Yes)
              </p>
              {remediationItems.length ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Remediation Required ({remediationItems.length} items)
                </p>
              ) : (
                <p className="mt-1 text-xs font-semibold text-emerald-700">No remediation required</p>
              )}
            </div>

            <div className="mt-4 max-h-[360px] space-y-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
              {assessmentQuestions.map((question, index) => (
                <div key={question} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">
                    {index + 1}. {question}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAssessmentAnswers((prev) => {
                          const next = [...prev];
                          next[index] = true;
                          return next;
                        })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        assessmentAnswers[index] === true
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAssessmentAnswers((prev) => {
                          const next = [...prev];
                          next[index] = false;
                          return next;
                        })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        assessmentAnswers[index] === false
                          ? "bg-red-600 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={submitAssessment}
                disabled={!allAssessmentAnswered || loading}
                className="rounded-xl bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Submit Assessment
              </button>
              <button
                type="button"
                onClick={sendToSiteGroup}
                disabled={!allAssessmentAnswered}
                className="inline-flex items-center gap-2 rounded-xl border border-[#311162] px-4 py-2 text-sm font-semibold text-[#311162] disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                Send to Site Group
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-semibold text-slate-800">Assessment History</h4>
              <span className="text-xs text-slate-500">{filteredAssessments.length} audits</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Subject</th>
                    <th className="px-4 py-3 text-left font-semibold">Conducted By</th>
                    <th className="px-4 py-3 text-left font-semibold">Score</th>
                    <th className="px-4 py-3 text-left font-semibold">Result</th>
                    <th className="px-4 py-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        No previous audits for {selectedStore}.
                      </td>
                    </tr>
                  ) : (
                    filteredAssessments.slice(0, 100).map((record) => (
                      <tr key={record.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(read(record, ["created_at"], todayStr())).toLocaleDateString("en-ZA")}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {read(record, ["assessment_type"], "Assessment")}
                        </td>
                        <td className="px-4 py-3">
                          {read(record, ["staff_id"], "") ? (
                            <Link
                              href={`/staff-management/${read(record, ["staff_id"], "")}?store=${encodeURIComponent(selectedStore)}`}
                              className="font-medium text-[#c2410c] underline decoration-[#fdba74] underline-offset-2 hover:text-[#9a3412]"
                            >
                              {assessmentSubjectDisplay(record)}
                            </Link>
                          ) : (
                            <span className="text-slate-700">{assessmentSubjectDisplay(record)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {read(record, ["assessor_name", "assessor"], "Unknown")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{read(record, ["score"], 0)}%</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const isPass = Number(read(record, ["score"], 0)) >= 80;
                            return (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isPass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {isPass ? "Pass" : "Fail"}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setViewRecord({ type: "assessment", data: record })}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </Tabs.Content>
      </Tabs.Root>

      {checklistFormOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Daily Checklist — {checklistStore}</h3>
              <button
                type="button"
                onClick={() => setChecklistFormOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {["equipment", "duties", "ppe"].map((section) => (
                <div key={section} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h4 className="mb-2 text-sm font-semibold capitalize text-slate-800">{section}</h4>
                  <div className="space-y-2">
                    {DAILY_CHECKLIST_CONFIG[section].map((label, index) => (
                      <div key={`${section}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-xs text-slate-700">{index + 1}. {label}</p>
                        <div className="mt-1 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setChecklistAnswer(section, index, true)}
                            className={`rounded px-2 py-1 text-[11px] font-semibold ${
                              checklistAnswers[section][index] === true
                                ? "bg-emerald-600 text-white"
                                : "border border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            Y
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklistAnswer(section, index, false)}
                            className={`rounded px-2 py-1 text-[11px] font-semibold ${
                              checklistAnswers[section][index] === false
                                ? "bg-red-600 text-white"
                                : "border border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            N
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supervisor *</span>
                <input
                  value={checklistSupervisor}
                  onChange={(e) => setChecklistSupervisor(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6a00]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toolbox Topic *</span>
                <select
                  value={toolboxTopic}
                  onChange={(e) => setToolboxTopic(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff6a00]"
                >
                  <option value="">Select topic...</option>
                  {DAILY_CHECKLIST_CONFIG.toolboxTopics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </label>
              {toolboxTopic === "Other" ? (
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other Topic</span>
                  <input
                    value={toolboxOther}
                    onChange={(e) => setToolboxOther(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6a00]"
                  />
                </label>
              ) : null}
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Huddle Notes</span>
                <textarea
                  value={huddleNotes}
                  onChange={(e) => setHuddleNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6a00]"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signoff Notes</span>
                <textarea
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#ff6a00]"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Attendees</h4>
                <button
                  type="button"
                  onClick={() => setAttendees((prev) => [...prev, { name: "", role: "" }])}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {attendees.map((attendee, index) => (
                  <div key={`att-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      placeholder="Name"
                      value={attendee.name}
                      onChange={(e) =>
                        setAttendees((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, name: e.target.value } : row))
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Role"
                      value={attendee.role}
                      onChange={(e) =>
                        setAttendees((prev) =>
                          prev.map((row, idx) => (idx === index ? { ...row, role: e.target.value } : row))
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttendees((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)))
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
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
                onClick={() => setChecklistFormOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitChecklist}
                className="rounded-xl bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-white"
              >
                Submit Checklist
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewRecord ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ClipboardCheck className="h-4.5 w-4.5 text-[#ff6a00]" />
                {viewRecord.type === "assessment" ? "Assessment Details" : "Checklist Details"}
              </h4>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <pre className="overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
              {JSON.stringify(viewRecord.data, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="fixed bottom-4 right-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          Loading...
        </div>
      ) : null}
    </div>
  );
}
