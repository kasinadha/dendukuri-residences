export function isMissingColumnError(message: string | null | undefined): boolean {
  return Boolean(message && /column .* does not exist|could not find.*column/i.test(message));
}

export const EXPENSE_LOCATION_MIGRATION_HINT =
  "Run supabase/migrations/20260829_expense_location_payer.sql in Supabase.";

export const PAYMENT_ACCOUNTS_MIGRATION_HINT =
  "Run supabase/migrations/20260829_building_revenue_accounts.sql in Supabase.";
