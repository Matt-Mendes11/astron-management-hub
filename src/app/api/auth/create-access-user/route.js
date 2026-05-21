import { NextResponse } from "next/server";
import { createOrUpdateAccessUser } from "../../../../lib/authAdmin";
import { createServerSupabaseClient } from "../../../../lib/supabaseServer";

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || String(profile?.role || "").toLowerCase() !== "manager") {
    return NextResponse.json({ error: "Only managers can create logins." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await createOrUpdateAccessUser({
    email: body.email,
    password: body.password,
    fullName: body.fullName,
    assignedStore: body.assignedStore,
    role: body.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, updated: result.updated });
}
