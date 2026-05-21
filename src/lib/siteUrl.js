/**
 * Public URL used in Supabase auth emails and redirects.
 * Set NEXT_PUBLIC_SITE_URL to your deployed app (or LAN IP for phone testing).
 */
export function getConfiguredSiteOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ||
    "";
  return configured.replace(/\/$/, "");
}

export function getAuthCallbackUrl() {
  const origin = getConfiguredSiteOrigin();
  if (!origin) return "";
  return `${origin}/auth/callback`;
}

export function getLoginRedirectUrl() {
  const origin = getConfiguredSiteOrigin();
  if (!origin) return "";
  return `${origin}/login`;
}
