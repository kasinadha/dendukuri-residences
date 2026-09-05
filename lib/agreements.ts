import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import { PROPERTY_NAME } from "@/lib/property";
import { formatInr } from "@/lib/receipts";
import { buildTenantMonthlyCharges } from "@/lib/tenant-charges";
import {
  formatWhatsAppBusinessPhoneDisplay,
  getWhatsAppBusinessConfig,
  toTenantWhatsAppUrl,
} from "@/lib/whatsapp";

export const DEFAULT_AGREEMENT_TITLE =
  "Rental agreement — Dendukuri's Residences";

export const DEFAULT_AGREEMENT_BODY = `This rental agreement is between the Landlord (${PROPERTY_NAME}, Bengaluru) and the Tenant named below, for the flat listed in the commercial terms.

1. Premises and term
The Tenant occupies the stated flat for residential use only. The arrangement follows the usual Bengaluru practice of an 11-month leave-and-licence style term, renewable by mutual consent.

2. Rent, maintenance, and other charges
The Tenant agrees the monthly rent, maintenance, parking, washing-machine, and other charges shown in the commercial terms. Rent and monthly charges are due by the 5th of each calendar month unless the Landlord agrees otherwise in writing. Electricity is billed separately from meter readings and is not house rent.

3. Security deposit
The deposit / advance shown in the commercial terms is held against unpaid dues, damage beyond normal wear, and keys. It is refundable after vacating, subject to deductions for outstanding amounts and documented repairs.

4. Use of premises
The Tenant shall not sublet, run a commercial activity, or house additional occupants beyond what was disclosed, without the Landlord's written consent. Common areas, parking, and the terrace must be kept clear and clean.

5. Waste and neighbouring plots
Household waste must be disposed of only in the designated building bins / BBMP collection. Throwing waste into neighbouring plots, vacant land, drains, or the street is prohibited. Each recorded offence attracts an automatic fine added to that month's dues:
• First offence: ₹500
• Second offence: ₹750
• Third offence: ₹1,000
• Each further offence: ₹250 more than the previous fine (₹1,250, ₹1,500, and so on).
The fine is added to the Tenant's outstanding dues and must be paid with rent.

6. Care of the flat
The Tenant shall keep the flat in good condition, report repairs promptly, and allow reasonable inspection with prior notice except in emergency.

7. Notice and termination
Either party may end the occupancy with the notice period agreed at move-in (typically 30 days) unless a lock-in applies. The Tenant remains liable for dues until keys are returned and the vacate date is recorded.

8. General
This document records house rules and commercial terms used at ${PROPERTY_NAME}, Bengaluru. It does not replace a stamped registered deed. By ticking the checkboxes and accepting, the Tenant confirms they have read the amounts and these terms.`;

export type AgreementTemplate = {
  id: string;
  version: number;
  title: string;
  body: string;
  isCurrent: boolean;
  createdAt: string;
};

export type AgreementChecks = {
  rent: boolean;
  maintenance: boolean;
  other: boolean;
  deposit: boolean;
  terms: boolean;
};

export type TenancyAgreement = {
  id: string;
  tenancyId: string;
  templateId: string;
  templateVersion: number | null;
  templateTitle: string | null;
  templateBody: string | null;
  flatNumber: string;
  tenantName: string;
  phone: string | null;
  monthlyRent: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  depositAmount: number;
  depositPaid: number;
  adminStatus: "draft" | "approved";
  tenantStatus: "pending" | "accepted";
  acceptedChecks: AgreementChecks | null;
  approvedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  lastRemindedAt: string | null;
  whatsappUrl: string | null;
};

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseChecks(value: unknown): AgreementChecks | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    rent: Boolean(row.rent),
    maintenance: Boolean(row.maintenance),
    other: Boolean(row.other),
    deposit: Boolean(row.deposit),
    terms: Boolean(row.terms),
  };
}

export function allAgreementChecksComplete(checks: AgreementChecks): boolean {
  return (
    checks.rent &&
    checks.maintenance &&
    checks.other &&
    checks.deposit &&
    checks.terms
  );
}

type TenancySnapshot = {
  tenancyId: string;
  flatNumber: string;
  tenantName: string;
  monthlyRent: number;
  maintenanceCharge: number;
  carParkingCharge: number;
  washingMachineCharge: number;
  otherMonthlyCharge: number;
  otherChargesNotes: string | null;
  depositAmount: number;
  depositPaid: number;
};

function snapshotEquals(
  agreement: Pick<
    TenancyAgreement,
    | "templateId"
    | "monthlyRent"
    | "maintenanceCharge"
    | "carParkingCharge"
    | "washingMachineCharge"
    | "otherMonthlyCharge"
    | "otherChargesNotes"
    | "depositAmount"
    | "depositPaid"
  >,
  snapshot: TenancySnapshot,
  templateId: string
): boolean {
  return (
    agreement.templateId === templateId &&
    agreement.monthlyRent === snapshot.monthlyRent &&
    agreement.maintenanceCharge === snapshot.maintenanceCharge &&
    agreement.carParkingCharge === snapshot.carParkingCharge &&
    agreement.washingMachineCharge === snapshot.washingMachineCharge &&
    agreement.otherMonthlyCharge === snapshot.otherMonthlyCharge &&
    (agreement.otherChargesNotes ?? "") === (snapshot.otherChargesNotes ?? "") &&
    agreement.depositAmount === snapshot.depositAmount &&
    agreement.depositPaid === snapshot.depositPaid
  );
}

export async function getCurrentAgreementTemplate(
  supabase: SupabaseClient
): Promise<AgreementTemplate | null> {
  const { data, error } = await supabase
    .from("agreement_templates")
    .select("id, version, title, body, is_current, created_at")
    .eq("is_current", true)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    version: data.version,
    title: data.title,
    body: data.body,
    isCurrent: data.is_current,
    createdAt: data.created_at,
  };
}

export async function listAgreementTemplates(
  supabase: SupabaseClient
): Promise<AgreementTemplate[]> {
  const { data, error } = await supabase
    .from("agreement_templates")
    .select("id, version, title, body, is_current, created_at")
    .order("version", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    body: row.body,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  }));
}

export async function publishAgreementTemplate(
  supabase: SupabaseClient,
  input: { title: string; body: string; createdBy: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = input.title.trim() || DEFAULT_AGREEMENT_TITLE;
  const body = input.body.trim();
  if (body.length < 40) {
    return { ok: false, error: "Paste the full house-rules text before publishing." };
  }

  const { data: latest } = await supabase
    .from("agreement_templates")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  await supabase
    .from("agreement_templates")
    .update({ is_current: false })
    .eq("is_current", true);

  const { data, error } = await supabase
    .from("agreement_templates")
    .insert({
      version: nextVersion,
      title,
      body,
      is_current: true,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not publish terms." };
  }

  await generateDraftAgreementsForActiveTenancies(supabase);
  return { ok: true, id: data.id };
}

async function loadActiveTenancySnapshots(
  supabase: SupabaseClient
): Promise<TenancySnapshot[]> {
  const { data, error } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      deposit_amount,
      security_deposit,
      deposit_paid,
      maintenance_charge,
      car_parking_charge,
      washing_machine_charge,
      other_monthly_charge,
      other_charges_notes,
      tenants ( full_name ),
      flats ( flat_number, maintenance_amount )
    `
    );

  if (error || !data) return [];

  return data
    .filter((row) => isActiveTenancyStatus(row.status))
    .map((row) => {
      const tenant = unwrapOne(row.tenants);
      const flat = unwrapOne(row.flats);
      const charges = buildTenantMonthlyCharges({
        maintenanceCharge:
          row.maintenance_charge == null ? null : num(row.maintenance_charge),
        carParkingCharge:
          row.car_parking_charge == null ? null : num(row.car_parking_charge),
        washingMachineCharge:
          row.washing_machine_charge == null
            ? null
            : num(row.washing_machine_charge),
        otherMonthlyCharge:
          row.other_monthly_charge == null ? null : num(row.other_monthly_charge),
        otherChargesNotes: row.other_charges_notes,
        flatMaintenanceFallback:
          flat?.maintenance_amount == null ? null : num(flat.maintenance_amount),
      });
      const depositAmount = num(row.deposit_amount ?? row.security_deposit);
      return {
        tenancyId: row.id,
        flatNumber: flat?.flat_number?.trim() || "—",
        tenantName: tenant?.full_name?.trim() || "Tenant",
        monthlyRent: num(row.monthly_rent),
        maintenanceCharge: charges.maintenanceCharge,
        carParkingCharge: charges.carParkingCharge,
        washingMachineCharge: charges.washingMachineCharge,
        otherMonthlyCharge: charges.otherMonthlyCharge,
        otherChargesNotes: charges.otherChargesNotes,
        depositAmount,
        depositPaid: num(row.deposit_paid),
      };
    });
}

async function loadLatestAgreementsByTenancy(
  supabase: SupabaseClient
): Promise<Map<string, TenancyAgreement>> {
  const { data, error } = await supabase
    .from("tenancy_agreements")
    .select(
      `
      id,
      tenancy_id,
      template_id,
      flat_number,
      tenant_name,
      monthly_rent,
      maintenance_charge,
      car_parking_charge,
      washing_machine_charge,
      other_monthly_charge,
      other_charges_notes,
      deposit_amount,
      deposit_paid,
      admin_status,
      tenant_status,
      accepted_checks,
      approved_at,
      accepted_at,
      created_at
    `
    )
    .order("created_at", { ascending: false });

  const map = new Map<string, TenancyAgreement>();
  if (error || !data) return map;

  for (const row of data) {
    if (map.has(row.tenancy_id)) continue;
    map.set(row.tenancy_id, mapAgreementRow(row, null, null));
  }
  return map;
}

export async function generateDraftAgreementForTenancy(
  supabase: SupabaseClient,
  tenancyId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const template = await getCurrentAgreementTemplate(supabase);
  if (!template) {
    return { ok: false, error: "Publish a rental-terms template first." };
  }

  const snapshots = await loadActiveTenancySnapshots(supabase);
  const snapshot = snapshots.find((row) => row.tenancyId === tenancyId);
  if (!snapshot) {
    return { ok: false, error: "Active tenancy not found." };
  }

  const latest = (await loadLatestAgreementsByTenancy(supabase)).get(tenancyId);
  if (latest && snapshotEquals(latest, snapshot, template.id)) {
    return { ok: true, id: latest.id };
  }

  const { data, error } = await supabase
    .from("tenancy_agreements")
    .insert({
      tenancy_id: snapshot.tenancyId,
      template_id: template.id,
      flat_number: snapshot.flatNumber,
      tenant_name: snapshot.tenantName,
      monthly_rent: snapshot.monthlyRent,
      maintenance_charge: snapshot.maintenanceCharge,
      car_parking_charge: snapshot.carParkingCharge,
      washing_machine_charge: snapshot.washingMachineCharge,
      other_monthly_charge: snapshot.otherMonthlyCharge,
      other_charges_notes: snapshot.otherChargesNotes,
      deposit_amount: snapshot.depositAmount,
      deposit_paid: snapshot.depositPaid,
      admin_status: "draft",
      tenant_status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not generate agreement." };
  }
  return { ok: true, id: data.id };
}

export async function generateDraftAgreementsForActiveTenancies(
  supabase: SupabaseClient
): Promise<{ created: number; skipped: number }> {
  const template = await getCurrentAgreementTemplate(supabase);
  if (!template) return { created: 0, skipped: 0 };

  const [snapshots, latestByTenancy] = await Promise.all([
    loadActiveTenancySnapshots(supabase),
    loadLatestAgreementsByTenancy(supabase),
  ]);

  const rows = snapshots.filter((snapshot) => {
    const latest = latestByTenancy.get(snapshot.tenancyId);
    return !latest || !snapshotEquals(latest, snapshot, template.id);
  });

  if (rows.length === 0) return { created: 0, skipped: snapshots.length };

  const { error } = await supabase.from("tenancy_agreements").insert(
    rows.map((snapshot) => ({
      tenancy_id: snapshot.tenancyId,
      template_id: template.id,
      flat_number: snapshot.flatNumber,
      tenant_name: snapshot.tenantName,
      monthly_rent: snapshot.monthlyRent,
      maintenance_charge: snapshot.maintenanceCharge,
      car_parking_charge: snapshot.carParkingCharge,
      washing_machine_charge: snapshot.washingMachineCharge,
      other_monthly_charge: snapshot.otherMonthlyCharge,
      other_charges_notes: snapshot.otherChargesNotes,
      deposit_amount: snapshot.depositAmount,
      deposit_paid: snapshot.depositPaid,
      admin_status: "draft",
      tenant_status: "pending",
    }))
  );

  if (error) return { created: 0, skipped: snapshots.length };
  return { created: rows.length, skipped: snapshots.length - rows.length };
}

export async function listTenancyAgreements(
  supabase: SupabaseClient
): Promise<TenancyAgreement[]> {
  const [{ data, error }, reminders] = await Promise.all([
    supabase
      .from("tenancy_agreements")
      .select(
        `
        id,
        tenancy_id,
        template_id,
        flat_number,
        tenant_name,
        monthly_rent,
        maintenance_charge,
        car_parking_charge,
        washing_machine_charge,
        other_monthly_charge,
        other_charges_notes,
        deposit_amount,
        deposit_paid,
        admin_status,
        tenant_status,
        accepted_checks,
        approved_at,
        accepted_at,
        created_at,
        agreement_templates ( version, title, body ),
        tenancies (
          tenants ( phone )
        )
      `
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("agreement_reminders")
      .select("agreement_id, reminded_at")
      .order("reminded_at", { ascending: false }),
  ]);

  if (error || !data) return [];

  const reminded = new Map<string, string>();
  for (const row of reminders.data ?? []) {
    if (!reminded.has(row.agreement_id)) {
      reminded.set(row.agreement_id, row.reminded_at);
    }
  }

  const latestOnly = new Map<string, TenancyAgreement>();
  for (const row of data) {
    if (latestOnly.has(row.tenancy_id)) continue;
    const template = unwrapOne(row.agreement_templates);
    const tenancy = unwrapOne(row.tenancies);
    const tenant = unwrapOne(tenancy?.tenants);
    latestOnly.set(
      row.tenancy_id,
      mapAgreementRow(row, template, tenant?.phone ?? null, reminded.get(row.id) ?? null)
    );
  }

  return [...latestOnly.values()].sort((a, b) =>
    a.flatNumber.localeCompare(b.flatNumber)
  );
}

export async function getLatestAgreementForTenancy(
  supabase: SupabaseClient,
  tenancyId: string
): Promise<TenancyAgreement | null> {
  const { data, error } = await supabase
    .from("tenancy_agreements")
    .select(
      `
      id,
      tenancy_id,
      template_id,
      flat_number,
      tenant_name,
      monthly_rent,
      maintenance_charge,
      car_parking_charge,
      washing_machine_charge,
      other_monthly_charge,
      other_charges_notes,
      deposit_amount,
      deposit_paid,
      admin_status,
      tenant_status,
      accepted_checks,
      approved_at,
      accepted_at,
      created_at,
      agreement_templates ( version, title, body )
    `
    )
    .eq("tenancy_id", tenancyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const template = unwrapOne(data.agreement_templates);
  return mapAgreementRow(data, template, null);
}

export async function getPendingApprovedAgreementForTenancy(
  supabase: SupabaseClient,
  tenancyId: string
): Promise<TenancyAgreement | null> {
  const latest = await getLatestAgreementForTenancy(supabase, tenancyId);
  if (!latest) return null;
  if (latest.adminStatus === "approved" && latest.tenantStatus !== "accepted") {
    return latest;
  }
  return null;
}

export async function approveTenancyAgreement(
  supabase: SupabaseClient,
  input: { id: string; approvedBy: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error: loadError } = await supabase
    .from("tenancy_agreements")
    .select("id, admin_status")
    .eq("id", input.id)
    .maybeSingle();

  if (loadError || !data) {
    return { ok: false, error: loadError?.message ?? "Agreement not found." };
  }

  const { error } = await supabase
    .from("tenancy_agreements")
    .update({
      admin_status: "approved",
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
      tenant_status: "pending",
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function acceptTenancyAgreement(
  supabase: SupabaseClient,
  input: { id: string; tenancyId: string; checks: AgreementChecks }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!allAgreementChecksComplete(input.checks)) {
    return {
      ok: false,
      error: "Tick every confirmation before accepting the terms.",
    };
  }

  const latest = await getLatestAgreementForTenancy(supabase, input.tenancyId);
  if (!latest || latest.id !== input.id) {
    return { ok: false, error: "This agreement is no longer current." };
  }
  if (latest.adminStatus !== "approved") {
    return { ok: false, error: "These terms are not available yet." };
  }
  if (latest.tenantStatus === "accepted") {
    return { ok: true };
  }

  const { error } = await supabase
    .from("tenancy_agreements")
    .update({
      tenant_status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_checks: input.checks,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function buildAgreementReminderMessage(row: {
  tenantName: string;
  flatNumber: string;
  monthlyRent: number;
}): string {
  const business = formatWhatsAppBusinessPhoneDisplay(
    getWhatsAppBusinessConfig().businessPhone
  );
  return `Hi ${row.tenantName}, please read and accept the rental terms for Flat ${row.flatNumber} in the tenant portal (rent ${formatInr(row.monthlyRent)} / month). — ${PROPERTY_NAME} (${business})`;
}

export function agreementWhatsAppUrl(row: TenancyAgreement): string | null {
  return toTenantWhatsAppUrl(row.phone, buildAgreementReminderMessage(row));
}

export async function markAgreementReminded(
  supabase: SupabaseClient,
  input: {
    agreementId: string;
    tenancyId: string;
    remindedBy: string;
    channel?: string | null;
    notes?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("agreement_reminders").insert({
    agreement_id: input.agreementId,
    tenancy_id: input.tenancyId,
    reminded_by: input.remindedBy,
    channel: input.channel?.trim() || "manual",
    notes: input.notes?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function mapAgreementRow(
  row: {
    id: string;
    tenancy_id: string;
    template_id: string;
    flat_number: string | null;
    tenant_name: string | null;
    monthly_rent: number | string | null;
    maintenance_charge: number | string | null;
    car_parking_charge: number | string | null;
    washing_machine_charge: number | string | null;
    other_monthly_charge: number | string | null;
    other_charges_notes: string | null;
    deposit_amount: number | string | null;
    deposit_paid: number | string | null;
    admin_status: string;
    tenant_status: string;
    accepted_checks: unknown;
    approved_at: string | null;
    accepted_at: string | null;
    created_at: string;
  },
  template: { version?: number; title?: string; body?: string } | null,
  phone: string | null,
  lastRemindedAt?: string | null
): TenancyAgreement {
  return {
    id: row.id,
    tenancyId: row.tenancy_id,
    templateId: row.template_id,
    templateVersion: template?.version ?? null,
    templateTitle: template?.title ?? null,
    templateBody: template?.body ?? null,
    flatNumber: row.flat_number?.trim() || "—",
    tenantName: row.tenant_name?.trim() || "Tenant",
    phone: phone?.trim() || null,
    monthlyRent: num(row.monthly_rent),
    maintenanceCharge: num(row.maintenance_charge),
    carParkingCharge: num(row.car_parking_charge),
    washingMachineCharge: num(row.washing_machine_charge),
    otherMonthlyCharge: num(row.other_monthly_charge),
    otherChargesNotes: row.other_charges_notes,
    depositAmount: num(row.deposit_amount),
    depositPaid: num(row.deposit_paid),
    adminStatus: row.admin_status === "approved" ? "approved" : "draft",
    tenantStatus: row.tenant_status === "accepted" ? "accepted" : "pending",
    acceptedChecks: parseChecks(row.accepted_checks),
    approvedAt: row.approved_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    lastRemindedAt: lastRemindedAt ?? null,
    whatsappUrl: toTenantWhatsAppUrl(
      phone,
      buildAgreementReminderMessage({
        tenantName: row.tenant_name?.trim() || "Tenant",
        flatNumber: row.flat_number?.trim() || "—",
        monthlyRent: num(row.monthly_rent),
      })
    ),
  };
}
