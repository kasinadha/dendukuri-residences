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

export const DEFAULT_JOINT_QR_URL = "/upi/default-receive-qr.png";

export type PaymentAccountUpiDefaults = {
  upiId: string | null;
  upiQrUrl: string | null;
  accountId: string | null;
};

export function getJointPaymentAccount(
  accounts: PaymentAccount[]
): PaymentAccount | null {
  return accounts.find((account) => account.code === "joint") ?? null;
}

export function jointAccountUpiDefaults(
  accounts: PaymentAccount[]
): PaymentAccountUpiDefaults {
  const joint = getJointPaymentAccount(accounts);
  return {
    accountId: joint?.id ?? null,
    upiId: joint?.upiId ?? null,
    upiQrUrl: joint?.upiQrUrl?.trim() || DEFAULT_JOINT_QR_URL,
  };
}

export async function loadJointUpiDefaults(
  supabase: SupabaseClient
): Promise<PaymentAccountUpiDefaults> {
  const { accounts } = await listPaymentAccounts(supabase);
  return jointAccountUpiDefaults(accounts);
}

export type PaymentAccountOption = {
  id: string;
  label: string;
  code: string;
};

const PAYMENT_ACCOUNT_SEEDS = [
  {
    code: "joint",
    label: "Joint account",
    sort_order: 1,
    notes: "Shared Canara / joint receiving account",
    upi_qr_url: DEFAULT_JOINT_QR_URL,
  },
  {
    code: "kasi",
    label: "Kasi",
    sort_order: 2,
    notes: "Kasinadha account",
    upi_qr_url: null,
  },
  {
    code: "kanthu",
    label: "Kanthu",
    sort_order: 3,
    notes: "Kanthu account",
    upi_qr_url: null,
  },
  {
    code: "pratyu",
    label: "Pratyu",
    sort_order: 4,
    notes: "Pratyu account",
    upi_qr_url: null,
  },
] as const;

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

export type ListPaymentAccountsResult = {
  accounts: PaymentAccount[];
  error: string | null;
  tableMissing: boolean;
};

function isMissingTableError(message: string): boolean {
  return /payment_accounts|relation .* does not exist|schema cache/i.test(
    message
  );
}

export async function ensurePaymentAccounts(
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("payment_accounts").upsert(
    PAYMENT_ACCOUNT_SEEDS.map((seed) => ({
      code: seed.code,
      label: seed.label,
      sort_order: seed.sort_order,
      notes: seed.notes,
      upi_qr_url: seed.upi_qr_url,
      is_active: true,
    })),
    { onConflict: "code" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listPaymentAccounts(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<ListPaymentAccountsResult> {
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
  if (error) {
    return {
      accounts: [],
      error: error.message,
      tableMissing: isMissingTableError(error.message),
    };
  }

  return {
    accounts: (data ?? []).map(mapRow),
    error: null,
    tableMissing: false,
  };
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

  const { accounts } = await listPaymentAccounts(supabase);
  const resolved = resolvePaymentAccountFromUpi(accounts, {
    upiId: input.upiId,
    upiQrUrl: input.upiQrUrl,
    buildingWing: input.buildingWing,
  });
  if (resolved?.id) return resolved.id;

  return getJointPaymentAccount(accounts)?.id ?? null;
}
