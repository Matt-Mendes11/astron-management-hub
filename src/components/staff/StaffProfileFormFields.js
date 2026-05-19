"use client";

import { POSITION_OPTIONS, TRAINING_STATUS_OPTIONS } from "../../lib/staff";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-600";
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#ff6e00] focus:ring-2 focus:ring-[#ff6e00]/20";

export default function StaffProfileFormFields({ form, setForm }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">Role &amp; contact</p>
        <label className="block space-y-1.5">
          <span className={labelClass}>Full name</span>
          <input
            className={inputClass}
            value={form.full_name}
            onChange={set("full_name")}
            placeholder="e.g. Matthew Mendes"
            autoComplete="name"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Position</span>
            <select className={`${inputClass} bg-white`} value={form.position} onChange={set("position")}>
              {POSITION_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Training status</span>
            <select
              className={`${inputClass} bg-white`}
              value={form.training_status}
              onChange={set("training_status")}
            >
              {TRAINING_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Employee ID</span>
            <input className={inputClass} value={form.employee_id} onChange={set("employee_id")} placeholder="Optional" />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Contact number</span>
            <input
              type="tel"
              className={inputClass}
              value={form.contact_number}
              onChange={set("contact_number")}
              placeholder="Optional"
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={labelClass}>Joined date</span>
          <input type="date" className={inputClass} value={form.joined_date} onChange={set("joined_date")} />
        </label>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">Personal details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>ID number</span>
            <input className={inputClass} value={form.id_number} onChange={set("id_number")} placeholder="National / ID" />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Date of birth</span>
            <input type="date" className={inputClass} value={form.date_of_birth} onChange={set("date_of_birth")} />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={labelClass}>Home address</span>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            value={form.home_address}
            onChange={set("home_address")}
            placeholder="Street, suburb, city"
            rows={2}
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#311162]/70">Emergency contact</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Contact name</span>
            <input
              className={inputClass}
              value={form.emergency_contact_name}
              onChange={set("emergency_contact_name")}
              placeholder="e.g. Jane Mendes"
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Contact phone</span>
            <input
              type="tel"
              className={inputClass}
              value={form.emergency_contact_phone}
              onChange={set("emergency_contact_phone")}
              placeholder="e.g. 082 000 0000"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
