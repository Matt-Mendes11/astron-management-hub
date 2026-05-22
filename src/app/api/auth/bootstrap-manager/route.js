import { NextResponse } from "next/server";
import { createOrUpdateAccessUser } from "../../../../lib/authAdmin";

const setupCode = process.env.MANAGER_SETUP_CODE || "";

export async function POST(request) {
  if (!setupCode) {
    return NextResponse.json(
      {
        error:
          "Manager setup is not enabled. Add MANAGER_SETUP_CODE to .env.local (local) or Vercel Environment Variables (production).",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const providedCode = String(body.setupCode || "");

  if (providedCode !== setupCode) {
    return NextResponse.json({ error: "Invalid manager setup code." }, { status: 403 });
  }

  const result = await createOrUpdateAccessUser({
    email: body.email,
    password: body.password,
    fullName: body.fullName,
    assignedStore: body.assignedStore,
    role: "manager",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, promoted: result.updated });
}
