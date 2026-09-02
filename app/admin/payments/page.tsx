import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import OwnerDuesRemindersPanel from "@/components/admin/OwnerDuesRemindersPanel";
import PaymentSubmissionsPanel from "@/components/admin/PaymentSubmissionsPanel";
import PaymentVoidButton from "@/components/admin/PaymentVoidButton";
import RecordPaymentForm, {
  type TenancyOption,
} from "@/components/admin/RecordPaymentForm";
import UnpaidRentRemindersPanel from "@/components/admin/UnpaidRentRemindersPanel";
import { requireAdmin } from "@/lib/auth";
import { buildingWingFromFlatNumber } from "@/lib/building-wing";
import { isActiveTenancyStatus } from "@/lib/occupancy";
import {
  listPaymentAccounts,
  resolvePaymentAccountFromUpi,
  toPaymentAccountOptions,
} from "@/lib/payment-accounts";
import { listPaymentSubmissions } from "@/lib/payment-submissions";
import { paymentStatusLabel } from "@/lib/payment-status";
import {
  formatDisplayDate,
  formatInr,
} from "@/lib/receipts";
import {
  listOwnerDueReminders,
  listUnpaidRentReminders,
} from "@/lib/reminders";
import { getMonthlyDuesSummary } from "@/lib/monthly-dues";
import { getMonthlyDepositsCollected } from "@/lib/building-revenue";
import { listPaymentHistory } from "@/lib/rent-month";
import { getWhatsAppBusinessConfig } from "@/lib/whatsapp";
import { currentBillingMonthKey } from "@/lib/rent-upi";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-800";
    case "partial":
      return "bg-amber-50 text-amber-900";
    case "overdue":
      return "bg-red-50 text-red-800";
    case "waived":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-sky-50 text-sky-800";
  }
}

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentsPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const month =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : undefined;
  const flat = typeof params.flat === "string" ? params.flat : undefined;
  const tenant = typeof params.tenant === "string" ? params.tenant : undefined;
  const status =
    typeof params.status === "string" ? params.status : undefined;

  const { data: tenancyRows } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      monthly_rent,
      deposit_amount,
      deposit_paid,
      security_deposit,
      tenants ( full_name ),
      flats ( id, flat_number, upi_id, upi_qr_url, payment_account_id )
    `
    )
    .order("created_at", { ascending: false });

  const whatsapp = getWhatsAppBusinessConfig();

  const [monthSummary, depositsCollected, history, pendingSubmissions, unpaidReminders, ownerDues, paymentAccountsResult] =
    await Promise.all([
      getMonthlyDuesSummary(supabase, month),
      getMonthlyDepositsCollected(
        supabase,
        month ?? currentBillingMonthKey()
      ),
      listPaymentHistory(supabase, {
        month,
        flat,
        tenant,
        status,
        limit: 80,
      }),
      listPaymentSubmissions(supabase, { status: "pending", limit: 40 }),
      listUnpaidRentReminders(supabase, month),
      listOwnerDueReminders(supabase),
      listPaymentAccounts(supabase),
    ]);

  const paymentAccounts = paymentAccountsResult.accounts;

  const accountOptions = toPaymentAccountOptions(paymentAccounts);

  const outstandingTenancyIds = new Set(
    monthSummary.rows
      .filter((row) => row.outstanding > 0 && row.status !== "waived")
      .map((row) => row.tenancyId)
  );

  const tenancyOptions: TenancyOption[] = (tenancyRows ?? [])
    .filter(
      (row) =>
        isActiveTenancyStatus(row.status) ||
        outstandingTenancyIds.has(row.id as string)
    )
    .map((row) => {
      const tenantRow = unwrapOne(row.tenants);
      const flatRow = unwrapOne(row.flats);
      const rent =
        row.monthly_rent == null ? null : Number(row.monthly_rent);
      const suggested = resolvePaymentAccountFromUpi(paymentAccounts, {
        upiId: flatRow?.upi_id,
        upiQrUrl: flatRow?.upi_qr_url,
        buildingWing: buildingWingFromFlatNumber(flatRow?.flat_number),
      });
      const vacated = !isActiveTenancyStatus(row.status);
      const flatNumber = flatRow?.flat_number?.trim() || "—";
      const tenantName = tenantRow?.full_name?.trim() || "Tenant";
      const depositAmount =
        row.deposit_amount != null
          ? Number(row.deposit_amount)
          : row.security_deposit != null
            ? Number(row.security_deposit)
            : null;
      const depositPaid =
        row.deposit_paid != null ? Number(row.deposit_paid) : null;
      return {
        id: row.id,
        flatId: flatRow?.id ?? "",
        flatNumber,
        tenantName,
        monthlyRent: Number.isFinite(rent) ? rent : null,
        depositAmount: Number.isFinite(depositAmount) ? depositAmount : null,
        depositPaid: Number.isFinite(depositPaid) ? depositPaid : null,
        label: `Flat ${flatNumber} — ${tenantName}${vacated ? " (vacated)" : ""}`,
        suggestedReceiverAccountId:
          flatRow?.payment_account_id ?? suggested?.id ?? null,
      };
    });

  const recordTenancyId =
    typeof params.record_tenancy === "string" ? params.record_tenancy : undefined;

  const filterMonth = month ?? monthSummary.billingMonthKey;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Rent & Payments
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Record collections against active tenancies (and vacated tenants
            with final-month dues). Issue unique receipts automatically.
          </p>
        </div>
        <a
          href="#record-payment"
          className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white sm:mt-0"
        >
          Record Payment
        </a>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: "Current month",
            value: monthSummary.billingMonthLabel,
            detail: filterMonth,
          },
          {
            title: "Dues expected",
            value: formatInr(monthSummary.totalExpected),
            detail: "Rent + monthly charges + electricity",
          },
          {
            title: "Dues collected",
            value: formatInr(monthSummary.totalCollected),
            detail: `${monthSummary.paidTenants} paid · ${monthSummary.partialTenants} partial`,
          },
          {
            title: "Deposits collected",
            value: formatInr(depositsCollected),
            detail: "Advance/deposit payments this month only",
          },
          {
            title: "Outstanding",
            value: formatInr(monthSummary.outstanding),
            detail: `${monthSummary.pendingTenants} pending/overdue`,
          },
          {
            title: "Paid tenants",
            value: String(monthSummary.paidTenants),
            detail: "Fully paid or waived",
          },
          {
            title: "Pending tenants",
            value: String(monthSummary.pendingTenants),
            detail: `${monthSummary.overdueTenants} overdue`,
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <UnpaidRentRemindersPanel
          billingMonthKey={unpaidReminders.billingMonthKey}
          billingMonthLabel={unpaidReminders.billingMonthLabel}
          rows={unpaidReminders.rows}
          whatsappBusinessPhone={whatsapp.businessPhoneDisplay}
          whatsappApiEnabled={whatsapp.apiEnabled}
        />
        <OwnerDuesRemindersPanel items={ownerDues} />
      </div>

      <div className="mt-8">
        <PaymentSubmissionsPanel
          submissions={pendingSubmissions}
          accounts={paymentAccounts}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecordPaymentForm
          tenancies={tenancyOptions}
          accounts={accountOptions}
          defaultTenancyId={recordTenancyId}
          defaultBillingMonth={filterMonth}
        />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900">
              Month ledger — {monthSummary.billingMonthLabel}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Active and vacated tenancies billed for the selected month.
            </p>
          </div>
          {monthSummary.rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No active tenancies for rent this month.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {monthSummary.rows.map((row) => (
                <li
                  key={row.tenancyId}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Flat {row.flatNumber} · {row.tenantName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Due {formatInr(row.totalDue)} · Paid{" "}
                      {formatInr(row.amountPaid)}
                      {row.chargesDue > 0 || row.electricityCharge > 0
                        ? ` (rent ${formatInr(row.rentDue)}${
                            row.chargesDue > 0
                              ? ` + charges ${formatInr(row.chargesDue)}`
                              : ""
                          }${
                            row.electricityCharge > 0
                              ? ` + electricity ${formatInr(row.electricityCharge)}`
                              : ""
                          })`
                        : ""}
                      {row.outstanding > 0
                        ? ` · Outstanding ${formatInr(row.outstanding)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                        row.status
                      )}`}
                    >
                      {paymentStatusLabel(row.status)}
                    </span>
                    {row.outstanding > 0 && row.status !== "waived" ? (
                      <Link
                        href={`/admin/payments?month=${filterMonth}&record_tenancy=${row.tenancyId}#record-payment`}
                        className="text-sm font-semibold text-emerald-700"
                      >
                        Record payment
                      </Link>
                    ) : null}
                    {row.lastReceiptId ? (
                      <Link
                        href={`/admin/receipts/${row.lastReceiptId}`}
                        className="text-sm font-semibold text-emerald-700"
                      >
                        View Receipt
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-slate-900">Payment history</h3>
          <p className="mt-1 text-sm text-slate-500">
            Filter by month, flat, tenant, or status. Historical rows are kept
            when tenancies end.
          </p>
          <form
            method="get"
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <input
              type="month"
              name="month"
              defaultValue={filterMonth}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              name="flat"
              placeholder="Flat"
              defaultValue={flat ?? ""}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              name="tenant"
              placeholder="Tenant"
              defaultValue={tenant ?? ""}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="waived">Waived</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Apply filters
            </button>
          </form>
        </div>

        {history.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No payments match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((row) => (
              <li
                key={row.paymentId}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    Flat {row.flatNumber} · {row.tenantName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.billingMonthLabel} · Paid {formatInr(row.amountPaid)}
                    {row.amountDue != null
                      ? ` of ${formatInr(row.amountDue)}`
                      : ""}{" "}
                    · {formatDisplayDate(row.paymentDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                      row.status
                    )}`}
                  >
                    {paymentStatusLabel(row.status)}
                  </span>
                  {row.receiptId ? (
                    <>
                      <Link
                        href={`/admin/receipts/${row.receiptId}`}
                        className="text-sm font-semibold text-emerald-700"
                      >
                        View Receipt
                      </Link>
                      <Link
                        href={`/admin/receipts/${row.receiptId}`}
                        className="text-sm font-semibold text-slate-600"
                      >
                        Download / Print
                      </Link>
                    </>
                  ) : null}
                  <PaymentVoidButton
                    paymentId={row.paymentId}
                    flatNumber={row.flatNumber}
                    tenantName={row.tenantName}
                    billingMonthLabel={row.billingMonthLabel}
                    amountPaidLabel={formatInr(row.amountPaid)}
                    receiptNumber={row.receiptNumber}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
