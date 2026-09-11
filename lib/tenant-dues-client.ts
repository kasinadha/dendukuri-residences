import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Server-side tenant portal reads need full row visibility; prefer service role when configured. */
export function getTenantDuesSupabaseClient(
  fallback: SupabaseClient
): SupabaseClient {
  const admin = createAdminClient();
  return admin.ok ? admin.client : fallback;
}
