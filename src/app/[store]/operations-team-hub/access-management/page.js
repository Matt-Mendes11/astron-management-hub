"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import AppDrillBack from "../../../../components/drilldown/AppDrillBack";
import { useAuthProfile } from "../../../../lib/authProfile";
import { supabase } from "../../../../lib/supabaseBrowser";
import { STORE_CONFIG, isValidStoreSlug, slugToLabel } from "../../../../lib/stores";

export const dynamic = "force-dynamic";

const emptyForm = {
  email: "",
  password: "",
  fullName: "",
  assignedStore: "Hillcrest",
  role: "staff",
};

const formatLoginDate = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AccessManagementPage() {
  const params = useParams();
  const storeSlug = String(params?.store || "");
  const storeName = isValidStoreSlug(storeSlug) ? slugToLabel(storeSlug) : "Hillcrest";
  const { profile, loading: profileLoading, isManager } = useAuthProfile();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const backHref = useMemo(
    () => (isValidStoreSlug(storeSlug) ? `/${storeSlug}/operations-team-hub` : "/"),
    [storeSlug]
  );

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError("");
    const { data, error: listError } = await supabase.rpc("list_access_users");
    if (listError) {
      setError(listError.message || "Could not load access list.");
      setUsers([]);
    } else {
      setUsers(data || []);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    const timeoutId = window.setTimeout(() => {
      if (isManager) {
        loadUsers();
      } else {
        setLoadingUsers(false);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isManager, loadUsers, profileLoading]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const createLogin = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");

    const email = form.email.trim();
    const password = form.password;
    const fullName = form.fullName.trim();
    if (!email || !password || !fullName) {
      setError("Email, password, and full name are required.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/auth/create-access-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        fullName,
        assignedStore: form.assignedStore,
        role: form.role,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(payload.error || "Could not create login.");
      return;
    }

    setForm({ ...emptyForm, assignedStore: storeName });
    setNotice(
      payload.updated
        ? `Login updated for ${fullName}. They can sign in immediately — no email confirmation needed.`
        : `Login created for ${fullName}. They can sign in immediately — no email confirmation needed.`
    );
    await loadUsers();
  };

  const revokeAccess = async (user) => {
    if (user.id === profile?.id) {
      setError("You cannot revoke your own access.");
      return;
    }
    if (!window.confirm(`Revoke access for ${user.full_name || user.email}?`)) return;

    setRevokingId(user.id);
    setError("");
    const { error: revokeError } = await supabase.rpc("revoke_access_user", {
      target_user_id: user.id,
    });
    setRevokingId("");

    if (revokeError) {
      setError(revokeError.message || "Could not revoke access.");
      return;
    }
    setNotice(`Access revoked for ${user.full_name || user.email}.`);
    await loadUsers();
  };

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <AppDrillBack backHref={backHref} />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Checking permissions...
        </div>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="space-y-4">
        <AppDrillBack backHref={backHref} />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">
          Access Management is restricted to Regional Managers.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AppDrillBack backHref={backHref} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#311162]/10 text-[#311162]">
                <ShieldCheck className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff6e00]">
                  Secure user administration
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">User Access Management</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Only Regional Managers can create or remove user access. Use this to set up new station supervisors.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold capitalize text-slate-600">
              Signed in as {profile?.role}
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={createLogin} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#ff6e00]/10 text-[#ff6e00]">
                <UserPlus className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">Create Login</h2>
                <p className="mt-1 text-xs text-slate-500">Email/password access for branch users.</p>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="w-full rounded-t-xl border-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#ff6e00] focus:bg-white"
                  placeholder="supervisor@station.co.za"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  className="w-full rounded-t-xl border-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#ff6e00] focus:bg-white"
                  placeholder="Temporary password"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Full Name</span>
                <input
                  value={form.fullName}
                  onChange={(event) => updateForm("fullName", event.target.value)}
                  className="w-full rounded-t-xl border-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#ff6e00] focus:bg-white"
                  placeholder="Station Supervisor"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Assigned Store</span>
                  <select
                    value={form.assignedStore}
                    onChange={(event) => updateForm("assignedStore", event.target.value)}
                    className="w-full rounded-t-xl border-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#ff6e00] focus:bg-white"
                  >
                    {STORE_CONFIG.map((store) => (
                      <option key={store.slug} value={store.label}>
                        {store.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Role</span>
                  <select
                    value={form.role}
                    onChange={(event) => updateForm("role", event.target.value)}
                    className="w-full rounded-t-xl border-0 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold capitalize text-slate-900 outline-none transition focus:border-[#ff6e00] focus:bg-white"
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {notice}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-[#ff6e00] px-4 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:shadow-orange-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {saving ? "Creating login..." : "Create secure login"}
            </button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5">
              <h2 className="text-base font-black text-slate-900">Current Access List</h2>
              <p className="mt-1 text-xs text-slate-500">Users with active Supabase Auth access.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Loading access list...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No access profiles found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{user.full_name || "Unnamed user"}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#311162]/10 px-2.5 py-1 text-xs font-black capitalize text-[#311162]">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {user.assigned_store || user.store_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatLoginDate(user.last_login_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => revokeAccess(user)}
                            disabled={revokingId === user.id || user.id === profile?.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                            {revokingId === user.id ? "Revoking..." : user.id === profile?.id ? "Current user" : "Revoke Access"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
