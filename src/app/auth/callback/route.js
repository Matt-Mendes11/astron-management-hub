import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getConfiguredSiteOrigin } from "../../../lib/siteUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function resolveRedirectBase(request) {
  return getConfiguredSiteOrigin() || request.nextUrl.origin;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") || "/";
  const redirectBase = resolveRedirectBase(request);
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  if (!code) {
    return NextResponse.redirect(`${redirectBase}/login?error=missing_auth_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${redirectBase}/login?error=auth_callback_failed`);
  }

  return NextResponse.redirect(`${redirectBase}${safeNext}`);
}
