"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { formatActionError } from "@/lib/format-action-error";
import { ensurePaymentAccounts, updatePaymentAccount } from "@/lib/payment-accounts";
import type { BuildingWing } from "@/lib/building-wing";
import {
  updateFlatUpiMapping,
  updateFlatUpiMappingForWing,
} from "@/lib/flats";

function asString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asBuildingWing(value: string): BuildingWing | null {
  const wing = value.trim().toUpperCase();
  if (wing === "C" || wing === "D") return wing;
  return null;
}

function revalidateAccountPaths() {
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/flats");
  revalidatePath("/tenant/pay");
  revalidatePath("/pay");
}

export async function updatePaymentAccountAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const result = await updatePaymentAccount(supabase, {
      id: asString(formData, "id"),
      label: asString(formData, "label"),
      upiId: asString(formData, "upi_id") || null,
      upiQrUrl: asString(formData, "upi_qr_url") || null,
      buildingWing: asBuildingWing(asString(formData, "building_wing")),
      notes: asString(formData, "notes") || null,
    });

    if (result.ok) revalidateAccountPaths();
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not save the account mapping."),
    };
  }
}

export async function ensurePaymentAccountsAction() {
  const { supabase } = await requireAdmin();
  try {
    const result = await ensurePaymentAccounts(supabase);
    if (result.ok) revalidateAccountPaths();
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not set up owner accounts."),
    };
  }
}

export async function updateFlatUpiMappingAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const result = await updateFlatUpiMapping(supabase, {
      flatId: asString(formData, "flat_id"),
      upiId: asString(formData, "upi_id") || null,
      upiQrUrl: asString(formData, "upi_qr_url") || null,
      paymentAccountId: asString(formData, "payment_account_id") || null,
    });
    if (result.ok) revalidateAccountPaths();
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not save the flat UPI details."),
    };
  }
}

export async function updateFlatUpiMappingForWingAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  try {
    const wingRaw = asString(formData, "wing").toUpperCase();
    if (wingRaw !== "C" && wingRaw !== "D") {
      return { ok: false as const, error: "Choose Building C or D." };
    }
    const result = await updateFlatUpiMappingForWing(supabase, {
      wing: wingRaw,
      upiId: asString(formData, "upi_id") || null,
      upiQrUrl: asString(formData, "upi_qr_url") || null,
      paymentAccountId: asString(formData, "payment_account_id") || null,
    });
    if (result.ok) revalidateAccountPaths();
    return result;
  } catch (error) {
    return {
      ok: false as const,
      error: formatActionError(error, "Could not update building UPI details."),
    };
  }
}
