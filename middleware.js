import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { isValidStoreSlug, labelToSlug, slugToLabel } from "./src/lib/stores";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/$/, "") || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function createMiddlewareClient(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  return { supabase, response };
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  const isStoreRoute = isValidStoreSlug(firstSegment);
  const isLoginRoute = pathname === "/login";

  const { supabase, response } = createMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isStoreRoute) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, store_name, assigned_store")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return NextResponse.redirect(new URL("/", request.url));

  const role = String(profile.role || "staff").toLowerCase();
  const assignedStore = profile.assigned_store || profile.store_name || "Hillcrest";
  const requestedStore = slugToLabel(firstSegment);

  if (role !== "manager" && pathname.startsWith(`/${firstSegment}/operations-team-hub/access-management`)) {
    return NextResponse.redirect(new URL(`/${firstSegment}/operations-team-hub`, request.url));
  }

  if (role !== "manager" && pathname.startsWith(`/${firstSegment}/admin-controls-sheet`)) {
    return NextResponse.redirect(new URL(`/${firstSegment}`, request.url));
  }

  if (role !== "manager" && assignedStore !== requestedStore) {
    return NextResponse.redirect(new URL(`/${labelToSlug(assignedStore)}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
