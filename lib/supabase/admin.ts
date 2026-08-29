import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server only (admin actions).
 * Never import from client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    const isProd = process.env.VERCEL_ENV === "production";
    const hint = isProd
      ? "Add SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables (Production), then redeploy."
      : "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (server only), then restart npm run dev.";
    return {
      ok: false as const,
      error: `SUPABASE_SERVICE_ROLE_KEY is not set. ${hint} Copy the service_role secret from Supabase → Project Settings → API. Never use NEXT_PUBLIC_ for this key.`,
    };
  }

  return {
    ok: true as const,
    client: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
