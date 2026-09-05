import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tenant portal reads use the signed-in user's JWT so RLS applies.
 * Do not switch to the service role here — that bypasses tenant isolation.
 */
export function getTenantDuesSupabaseClient(
  fallback: SupabaseClient
): SupabaseClient {
  return fallback;
}
