import type { ReactElement, ReactNode } from "react";
import type { TenantFaqItem } from "@/lib/tenant-faq-content";

type MockupKind = NonNullable<TenantFaqItem["mockup"]>;

function MockupChrome({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold text-emerald-700">
          Dendukuri&apos;s Residences
        </span>
        <span className="text-xs text-slate-400">· Tenant portal</span>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1.5 text-[10px] font-medium text-slate-500">
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-800">Home</span>
        <span className="rounded-lg px-2 py-1">Pay rent</span>
        <span className="rounded-lg px-2 py-1">Receipts</span>
        <span className="rounded-lg px-2 py-1">Cameras</span>
        <span className="rounded-lg px-2 py-1">Electricity</span>
        <span className="rounded-lg px-2 py-1">Maintenance</span>
        <span className="rounded-lg px-2 py-1">Move</span>
      </div>
      {children}
    </div>
  );
}

function HomeMockup() {
  return (
    <MockupChrome>
      <div className="space-y-3 p-4">
        <p className="text-xs font-semibold text-emerald-700">WELCOME</p>
        <p className="text-sm font-bold text-slate-900">Abilash</p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[10px] font-semibold uppercase text-amber-800">
            Monthly dues · 2026-08
          </p>
          <p className="mt-1 text-sm font-bold text-amber-950">
            Outstanding ₹22,500
          </p>
          <p className="mt-1 text-[10px] text-amber-900">
            Rent ₹21,000 + parking ₹1,000 + electricity ₹500
          </p>
          <p className="mt-2 inline-block rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
            Pay now →
          </p>
        </div>
      </div>
    </MockupChrome>
  );
}

function PayMockup() {
  return (
    <MockupChrome>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-900">Pay via UPI</p>
          <p className="mt-2 text-[10px] text-slate-500">UPI ID</p>
          <p className="text-xs font-bold text-slate-900">name@bank</p>
          <div className="mt-2 h-20 w-20 rounded-lg border border-slate-200 bg-white" />
          <p className="mt-2 inline-block rounded bg-emerald-600 px-2 py-1 text-[10px] text-white">
            Open UPI app
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 p-3">
          <p className="text-xs font-bold text-slate-900">Submit UTR</p>
          <div className="mt-2 space-y-1.5">
            <div className="h-6 rounded border border-slate-200 bg-white text-[9px] leading-6 text-slate-400 px-2">
              Billing month
            </div>
            <div className="h-6 rounded border border-slate-200 bg-white text-[9px] leading-6 text-slate-400 px-2">
              Amount ₹22,500
            </div>
            <div className="h-6 rounded border border-slate-200 bg-white text-[9px] leading-6 text-slate-400 px-2">
              UTR reference
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-emerald-700">
            Submit payment claim
          </p>
        </div>
      </div>
      <div className="mx-3 mb-3 rounded border border-slate-100 p-2 text-[9px] text-slate-600">
        <p className="font-semibold text-slate-800">Dues breakdown</p>
        <p>Rent ₹21,000 · Parking ₹1,000 · Electricity ₹500</p>
      </div>
    </MockupChrome>
  );
}

function ReceiptsMockup() {
  return (
    <MockupChrome>
      <div className="divide-y divide-slate-100 p-3">
        <div className="py-2">
          <p className="text-xs font-bold text-slate-900">DR-2026-00842</p>
          <p className="text-[10px] text-slate-500">Aug 2026 · Flat C102 · ₹22,500</p>
          <p className="text-[10px] font-semibold text-emerald-700">Download PDF</p>
        </div>
        <div className="py-2 opacity-60">
          <p className="text-xs font-bold text-slate-900">DR-2026-00791</p>
          <p className="text-[10px] text-slate-500">Jul 2026 · Flat C102 · ₹21,000</p>
        </div>
      </div>
    </MockupChrome>
  );
}

function ElectricityMockup() {
  return (
    <MockupChrome>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-900">Electricity bills</p>
        <div className="mt-2 rounded border border-slate-100 p-2 text-[10px]">
          <p className="font-semibold">Aug 2026</p>
          <p className="text-slate-500">142 units · Bill ₹500</p>
        </div>
        <div className="mt-2 rounded border border-slate-100 p-2 text-[10px] opacity-70">
          <p className="font-semibold">Jul 2026</p>
          <p className="text-slate-500">128 units · Bill ₹420</p>
        </div>
      </div>
    </MockupChrome>
  );
}

function MaintenanceMockup() {
  return (
    <MockupChrome>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-900">New request</p>
        <div className="mt-2 h-6 rounded border border-slate-200 text-[9px] leading-6 text-slate-400 px-2">
          Title: Kitchen tap leaking
        </div>
        <div className="mt-1.5 h-10 rounded border border-slate-200 text-[9px] text-slate-400 p-1">
          Description…
        </div>
        <p className="mt-2 inline-block rounded bg-emerald-600 px-2 py-1 text-[10px] text-white">
          Submit request
        </p>
      </div>
    </MockupChrome>
  );
}

function CamerasMockup() {
  return (
    <MockupChrome>
      <div className="space-y-3 p-3">
        <p className="text-xs font-bold text-slate-900">Common-area cameras</p>
        <div className="rounded-lg border border-slate-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900">Main gate</p>
              <p className="text-[10px] text-slate-500">Gate / parking</p>
            </div>
            <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
              View live
            </span>
          </div>
          <div className="mt-3 aspect-video rounded-lg bg-slate-900" />
        </div>
      </div>
    </MockupChrome>
  );
}

function VacateMockup() {
  return (
    <MockupChrome>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-900">Move out or transfer</p>
        <div className="mt-2 flex gap-2 text-[10px]">
          <span className="rounded bg-slate-900 px-2 py-1 text-white">Move out</span>
          <span className="rounded bg-slate-100 px-2 py-1">Transfer</span>
        </div>
        <div className="mt-2 h-10 rounded border border-slate-200 text-[9px] text-slate-400 p-1">
          Reason for moving…
        </div>
        <p className="mt-2 text-[10px] text-slate-500">Your requests · pending</p>
      </div>
    </MockupChrome>
  );
}

const mockups: Record<MockupKind, () => ReactElement> = {
  home: HomeMockup,
  pay: PayMockup,
  receipts: ReceiptsMockup,
  electricity: ElectricityMockup,
  maintenance: MaintenanceMockup,
  vacate: VacateMockup,
  cameras: CamerasMockup,
};

export default function HelpScreenMockup({ kind }: { kind: MockupKind }) {
  const Component = mockups[kind];
  return (
    <div className="my-4" aria-hidden="true">
      <Component />
      <p className="mt-2 text-center text-xs text-slate-500">
        Illustration — your screen may show your flat and amounts.
      </p>
    </div>
  );
}
