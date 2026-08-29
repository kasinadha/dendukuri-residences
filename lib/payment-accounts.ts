import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildingWing } from "@/lib/building-wing";

export type PaymentAccount = {
  id: string;
  code: string;
  label: string;
  upiId: string | null;
  upiQrUrl: string | null;
  buildingWing: BuildingWing | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
};

export type PaymentAccountOption = {
  id: string;
  label: string;
  code: string;
};

function normalizeUpi(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function normalizeQrUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function mapRow(row: {
  id: string;
  code: string;
  label: string;
  upi_id: string | null;
  upi_qr_url: string | null;
  building_wing: string | null;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
}): PaymentAccount {
  const wing = row.building_wing?.trim().toUpperCase();
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    upiId: row.upi_id,
    upiQrUrl: row.upi_qr_url,
    buildingWing: wing === "C" || wing === "D" ? wing : null,
    sortOrder: row.sort_order ?? 0,
    isActive: Boolean(row.is_active),
    notes: row.notes,
  };
}

export async function listPaymentAccounts(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<PaymentAccount[]> {
  let query = supabase
    .from("payment_accounts")
    .select(
      "id,code,label,upi_id,upi_qr_url,building_wing,sort_order,is_active,notes"
    )
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapRow);
}

export function toPaymentAccountOptions(
  accounts: PaymentAccount[]
): PaymentAccountOption[] {
  return accounts.map((account) => ({
    id: account.id,
    code: account.code,
    label: account.label,
  }));
}

/** Match account by UPI VPA and/or static QR image URL. */
export function resolvePaymentAccountFromUpi(
  accounts: PaymentAccount[],
  input?: {
    upiId?: string | null;
    upiQrUrl?: string | null;
    buildingWing?: BuildingWing | null;
  }
): PaymentAccount | null {
  const upi = normalizeUpi(input?.upiId);
  const qr = normalizeQrUrl(input?.upiQrUrl);

  if (upi) {
    const byUpi = accounts.find(
      (account) => normalizeUpi(account.upiId) === upi
    );
    if (byUpi) return byUpi;
  }

  if (qr) {
    const byQr = accounts.find(
      (account) => normalizeQrUrl(account.upiQrUrl) === qr
    );
    if (byQr) return byQr;
  }

  if (input?.buildingWing) {
    const byWing = accounts.find(
      (account) => account.buildingWing === input.buildingWing
    );
    if (byWing) return byWing;
  }

  return null;
}

export async function updatePaymentAccount(
  supabase: SupabaseClient,
  input: {
    id: string;
    label: string;
    upiId?: string | null;
    upiQrUrl?: string | null;
    buildingWing?: BuildingWing | null;
    notes?: string | null;
    isActive?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Account id is required." };
  if (!input.label.trim()) return { ok: false, error: "Label is required." };

  const { error } = await supabase
    .from("payment_accounts")
    .update({
      label: input.label.trim(),
      upi_id: input.upiId?.trim() || null,
      upi_qr_url: input.upiQrUrl?.trim() || null,
      building_wing: input.buildingWing ?? null,
      notes: input.notes?.trim() || null,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveReceiverAccountId(
  supabase: SupabaseClient,
  input: {
    explicitAccountId?: string | null;
    upiId?: string | null;
    upiQrUrl?: string | null;
    flatPaymentAccountId?: string | null;
    buildingWing?: BuildingWing | null;
  }
): Promise<string | null> {
  if (input.explicitAccountId?.trim()) return input.explicitAccountId.trim();

  if (input.flatPaymentAccountId?.trim()) {
    return input.flatPaymentAccountId.trim();
  }

  const accounts = await listPaymentAccounts(supabase);
  const resolved = resolvePaymentAccountFromUpi(accounts, {
    upiId: input.upiId,
    upiQrUrl: input.upiQrUrl,
    buildingWing: input.buildingWing,
  });
  return resolved?.id ?? null;
}
