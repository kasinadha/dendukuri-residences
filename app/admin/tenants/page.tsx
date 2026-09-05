import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import FormerTenantActions from "@/components/admin/FormerTenantActions";
import SyncMoveInDatesButton from "@/components/admin/SyncMoveInDatesButton";
import TenantDetailsEditor from "@/components/admin/TenantDetailsEditor";
import TenantLoginActions from "@/components/admin/TenantLoginActions";
import TenantOccupancyActions from "@/components/admin/TenantOccupancyActions";
import NameChangeRequestsPanel from "@/components/admin/NameChangeRequestsPanel";
import { requireAdmin } from "@/lib/auth";
import { listFlatsForAdmin } from "@/lib/flats";
import { formatDisplayDate, formatInr } from "@/lib/receipts";
import { listTenantsForAdmin } from "@/lib/tenants";
import { buildTenantDuplicateMergeMap } from "@/lib/tenant-duplicates";
import { listUnpaidRentReminders } from "@/lib/reminders";
import { listPendingNameChangeRequests } from "@/lib/tenant-change-requests";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const showFormer = params.show === "former" || params.show === "all";
  const showArchived = params.show === "archived";

  const [tenants, flats, unpaidDues, nameChanges] = await Promise.all([
    listTenantsForAdmin(supabase),
    listFlatsForAdmin(supabase),
    listUnpaidRentReminders(supabase),
    listPendingNameChangeRequests(supabase),
  ]);

  const nonArchivedTenants = tenants.filter((t) => !t.isArchived);
  const activeTenants = nonArchivedTenants.filter((t) => t.hasActiveTenancy);
  const formerTenants = nonArchivedTenants.filter((t) => !t.hasActiveTenancy);
  const archivedCount = tenants.filter((t) => t.isArchived).length;

  const visibleTenants = showArchived
    ? tenants.filter((t) => t.isArchived)
    : nonArchivedTenants;

  const listedTenants = showFormer || showArchived ? visibleTenants : activeTenants;
  const duplicateMergeMap = buildTenantDuplicateMergeMap(tenants);
  const duplicateCount = duplicateMergeMap.size;
  const vacantFlats = flats
    .filter((f) => !f.isOccupied)
    .map((f) => ({
      id: f.id,
      label: `Flat ${f.flatNumber}${f.type !== "—" ? ` · ${f.type}` : ""}`,
    }));

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MODULE</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Tenants
          </h2>
          <p className="mt-2 max-w-2xl text-slate-500">
            Active tenants with linked flat, rent, monthly charges, move-in date,
            and advance/deposit. Contact details are freely editable; rent,
            charges, and advance are locked and need confirmation to change.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 ring-1 ring-emerald-100">
            {activeTenants.length} active
          </span>
          {formerTenants.length > 0 ? (
            <span className="rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
              {formerTenants.length} former
            </span>
          ) : null}
          {archivedCount > 0 ? (
            <span className="rounded-xl bg-white px-3 py-2 font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
              {archivedCount} archived
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {showArchived ? (
          <>
            <span className="font-semibold text-slate-700">
              Showing archived tenants
            </span>
            <Link
              href="/admin/tenants"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm"
            >
              Active only
            </Link>
          </>
        ) : showFormer ? (
          <>
            <span className="font-semibold text-slate-700">
              Showing all tenants (active + former)
            </span>
            <Link
              href="/admin/tenants"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm"
            >
              Active only
            </Link>
            {archivedCount > 0 ? (
              <Link
                href="/admin/tenants?show=archived"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm"
              >
                Archived ({archivedCount})
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <span className="font-semibold text-slate-700">
              Showing active tenants only
            </span>
            {formerTenants.length > 0 ? (
              <Link
                href="/admin/tenants?show=former"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm"
              >
                Show former ({formerTenants.length})
              </Link>
            ) : null}
            {archivedCount > 0 ? (
              <Link
                href="/admin/tenants?show=archived"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm"
              >
                Archived ({archivedCount})
              </Link>
            ) : null}
          </>
        )}
      </div>

      {duplicateCount > 0 && !showArchived ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-semibold">
            {duplicateCount} duplicate former tenant
            {duplicateCount === 1 ? "" : "s"} share a mobile with an active
            tenant.
          </p>
          <p className="mt-1">
            Open <strong>Show former</strong> and use{" "}
            <strong>Merge into …</strong> on the stale row to combine records
            (e.g. Priyakshi → Priyanshi on C201).
          </p>
        </div>
      ) : null}

      <NameChangeRequestsPanel rows={nameChanges} />

      {unpaidDues.rows.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
          <p className="font-semibold text-amber-950">
            {unpaidDues.rows.length} tenant
            {unpaidDues.rows.length === 1 ? "" : "s"} with unpaid monthly dues
            · {unpaidDues.billingMonthLabel}
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Includes rent, maintenance, parking, washer, and other monthly
            charges. Send reminders from{" "}
            <a href="/admin/payments" className="font-semibold underline">
              Payments
            </a>
            .
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <SyncMoveInDatesButton />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {listedTenants.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            {showArchived
              ? "No archived tenants."
              : showFormer
                ? "No tenants found. Add tenants in Supabase to see them here."
                : "No active tenants right now."}
          </p>
        ) : (
          <>
            <div className="hidden border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[0.9fr_0.85fr_0.5fr_0.45fr_0.55fr_0.75fr_0.75fr_0.5fr_0.8fr_0.75fr_0.9fr] lg:gap-2 lg:px-6">
              <span>Name</span>
              <span>Contact</span>
              <span>Flat</span>
              <span>Type</span>
              <span>Rent</span>
              <span>Charges</span>
              <span>Advance</span>
              <span>Status</span>
              <span>Portal login</span>
              <span>Occupancy</span>
              <span>Details</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {listedTenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="grid gap-2 px-5 py-4 lg:grid-cols-[0.9fr_0.85fr_0.5fr_0.45fr_0.55fr_0.75fr_0.75fr_0.5fr_0.8fr_0.75fr_0.9fr] lg:items-start lg:gap-2 lg:px-6"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Name
                    </p>
                    <p className="font-semibold text-slate-900">
                      {tenant.fullName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Contact
                    </p>
                    <p className="text-sm text-slate-700">
                      {tenant.phone ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tenant.email ?? "No email"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Flat
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {tenant.flatNumber ?? "—"}
                      {!tenant.hasActiveTenancy && tenant.lastFlatNumber ? (
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          (last)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Type
                    </p>
                    <p className="text-sm text-slate-700">
                      {tenant.flatType ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Rent
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {tenant.monthlyRent != null
                        ? formatInr(tenant.monthlyRent)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Charges
                    </p>
                    {tenant.monthlyCharges ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatInr(tenant.monthlyCharges.totalMonthlyCharges)}
                          <span className="font-normal text-slate-500">
                            {" "}
                            /mo
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Maint {formatInr(tenant.monthlyCharges.maintenanceCharge)}
                        </p>
                        <p className="text-xs text-slate-600">
                          Park {formatInr(tenant.monthlyCharges.carParkingCharge)}
                          {" · "}Washer{" "}
                          {formatInr(tenant.monthlyCharges.washingMachineCharge)}
                        </p>
                        {tenant.monthlyCharges.otherMonthlyCharge > 0 ||
                        tenant.monthlyCharges.otherChargesNotes ? (
                          <p className="text-xs text-slate-600">
                            Other{" "}
                            {formatInr(tenant.monthlyCharges.otherMonthlyCharge)}
                            {tenant.monthlyCharges.otherChargesNotes
                              ? ` · ${tenant.monthlyCharges.otherChargesNotes}`
                              : ""}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Advance
                    </p>
                    {tenant.hasActiveTenancy ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">
                          {tenant.depositAmount != null
                            ? formatInr(tenant.depositAmount)
                            : "—"}{" "}
                          <span className="font-normal text-slate-500">
                            agreed
                          </span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Paid{" "}
                          {tenant.depositPaid != null
                            ? formatInr(tenant.depositPaid)
                            : "—"}
                          {tenant.depositPaidDate
                            ? ` · ${tenant.depositPaidDate}`
                            : ""}
                        </p>
                        {tenant.depositAmount != null &&
                        tenant.depositPaid != null &&
                        tenant.depositAmount > tenant.depositPaid ? (
                          <p className="text-xs font-semibold text-amber-800">
                            Balance{" "}
                            {formatInr(
                              tenant.depositAmount - tenant.depositPaid
                            )}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Status
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        tenant.hasActiveTenancy
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tenant.hasActiveTenancy
                        ? tenant.moveInDate
                          ? `moved in ${formatDisplayDate(tenant.moveInDate)}`
                          : tenant.tenancyStatus ?? "active"
                        : tenant.vacatedDate
                          ? `vacated · ${formatDisplayDate(tenant.vacatedDate)}`
                          : tenant.tenancyStatus ?? "former"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Portal login
                    </p>
                    <TenantLoginActions
                      tenantId={tenant.id}
                      fullName={tenant.fullName}
                      phone={tenant.phone}
                      email={tenant.email}
                      hasPortalLogin={tenant.hasPortalLogin}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Occupancy
                    </p>
                    {tenant.hasActiveTenancy && tenant.tenancyId ? (
                      <TenantOccupancyActions
                        tenancyId={tenant.tenancyId}
                        vacantFlats={vacantFlats}
                        currentRent={tenant.monthlyRent}
                      />
                    ) : tenant.isArchived ? (
                      <p className="text-sm text-slate-500">Archived</p>
                    ) : (
                      <FormerTenantActions
                        tenantId={tenant.id}
                        tenantName={tenant.fullName}
                        endedTenancyId={tenant.endedTenancyId}
                        vacatedDate={tenant.vacatedDate}
                        lastFlatNumber={tenant.lastFlatNumber}
                        mergeTarget={duplicateMergeMap.get(tenant.id) ?? null}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
                      Details
                    </p>
                    <TenantDetailsEditor
                      tenantId={tenant.id}
                      fullName={tenant.fullName}
                      phone={tenant.phone}
                      email={tenant.email}
                      monthlyRent={tenant.monthlyRent}
                      depositAmount={tenant.depositAmount}
                      depositPaid={tenant.depositPaid}
                      depositPaidDate={tenant.depositPaidDate}
                      depositReturned={tenant.depositReturned}
                      depositReturnedDate={tenant.depositReturnedDate}
                      monthlyCharges={tenant.monthlyCharges}
                      tenancyId={tenant.tenancyId}
                      hasActiveTenancy={tenant.hasActiveTenancy}
                      moveInDate={tenant.moveInDate}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
