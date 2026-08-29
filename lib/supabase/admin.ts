import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server only (admin actions).
 * Never import from client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      ok: false as const,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server only) from Supabase → Project Settings → API.",
    };
  }

  return {
    ok: true as const,
    client: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
