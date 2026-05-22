import { createClient } from "@supabase/supabase-js";
import { STORE_CONFIG } from "./stores";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const storeLabels = new Set(STORE_CONFIG.map((store) => store.label));
const allowedRoles = new Set(["manager", "staff"]);

export function getSupabaseAdmin() {
  if (!supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isInvalidApiKeyError(error) {
  return /invalid api key|api key/i.test(String(error?.message || ""));
}

async function findUserByEmail(supabaseAdmin, email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return { user: null, error };
  const user = data?.users?.find(
    (entry) => String(entry.email || "").toLowerCase() === email.toLowerCase()
  );
  return { user: user || null, error: null };
}

export async function createOrUpdateAccessUser({
  email,
  password,
  fullName,
  assignedStore,
  role,
}) {
  const normalizedEmail = String(email || "").trim();
  const normalizedPassword = String(password || "");
  const normalizedName = String(fullName || "").trim();
  const normalizedStore = String(assignedStore || "Hillcrest");
  const normalizedRole = String(role || "staff").toLowerCase();

  if (!normalizedEmail || !normalizedPassword || !normalizedName) {
    return { ok: false, status: 400, error: "Email, password, and full name are required." };
  }

  if (!storeLabels.has(normalizedStore)) {
    return { ok: false, status: 400, error: "Invalid assigned store." };
  }

  if (!allowedRoles.has(normalizedRole)) {
    return { ok: false, status: 400, error: "Invalid role." };
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 503,
      error:
        "User creation is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY to .env.local for local dev, or to your Vercel project Environment Variables (Settings → Environment Variables), then redeploy.",
    };
  }

  const { user: existingUser, error: findError } = await findUserByEmail(supabaseAdmin, normalizedEmail);
  if (findError) {
    if (isInvalidApiKeyError(findError)) {
      return { ok: false, status: 400, error: "Invalid SUPABASE_SERVICE_ROLE_KEY for this project." };
    }
    return { ok: false, status: 400, error: findError.message || "Could not check existing user." };
  }

  let userId = existingUser?.id || "";

  if (existingUser) {
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password: normalizedPassword,
      email_confirm: true,
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        full_name: normalizedName,
        assigned_store: normalizedStore,
        role: normalizedRole,
      },
    });
    if (updateAuthError) {
      if (isInvalidApiKeyError(updateAuthError)) {
        return { ok: false, status: 400, error: "Invalid SUPABASE_SERVICE_ROLE_KEY for this project." };
      }
      return { ok: false, status: 400, error: updateAuthError.message || "Could not update login." };
    }
  } else {
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        assigned_store: normalizedStore,
        role: normalizedRole,
      },
    });
    if (createError) {
      if (isInvalidApiKeyError(createError)) {
        return { ok: false, status: 400, error: "Invalid SUPABASE_SERVICE_ROLE_KEY for this project." };
      }
      return { ok: false, status: 400, error: createError.message || "Could not create login." };
    }
    userId = data.user?.id || "";
  }

  if (!userId) {
    return { ok: false, status: 400, error: "Could not resolve user id." };
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: normalizedName,
    role: normalizedRole,
    store_name: normalizedStore,
    assigned_store: normalizedStore,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    if (isInvalidApiKeyError(profileError)) {
      return { ok: false, status: 400, error: "Invalid SUPABASE_SERVICE_ROLE_KEY for this project." };
    }
    return {
      ok: false,
      status: 400,
      error: profileError.message || "Login saved, but profile update failed.",
    };
  }

  return { ok: true, userId, updated: Boolean(existingUser) };
}
