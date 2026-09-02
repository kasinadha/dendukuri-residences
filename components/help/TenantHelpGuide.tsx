"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import HelpScreenMockup from "@/components/help/HelpScreenMockup";
import {
  tenantFaqSections,
  type TenantFaqItem,
  type TenantFaqSection,
} from "@/lib/tenant-faq-content";

function FaqAnswer({ item }: { item: TenantFaqItem }) {
  return (
    <div className="space-y-4 text-sm leading-6 text-slate-600">
      <p>{item.answer}</p>

      {item.imageSrc ? (
        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <Image
            src={item.imageSrc}
            alt={item.imageAlt ?? ""}
            width={1200}
            height={800}
            className="h-auto w-full"
          />
          {item.imageCaption ? (
            <figcaption className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
              {item.imageCaption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {item.mockup ? <HelpScreenMockup kind={item.mockup} /> : null}

      {item.steps && item.steps.length > 0 ? (
        <ol className="space-y-3">
          {item.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-slate-600">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {item.tips && item.tips.length > 0 ? (
        <ul className="rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-950">
          {item.tips.map((tip) => (
            <li key={tip} className="mt-1 list-inside list-disc first:mt-0">
              {tip}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FaqItemCard({ item }: { item: TenantFaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6"
        aria-expanded={open}
      >
        <span className="font-semibold text-slate-900">{item.question}</span>
        <span className="shrink-0 text-lg text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-5 pb-5 sm:px-6">
          <FaqAnswer item={item} />
        </div>
      ) : null}
    </div>
  );
}

function SectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: TenantFaqSection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelect(section.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            activeId === section.id
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          {section.title}
        </button>
      ))}
    </nav>
  );
}

export default function TenantHelpGuide() {
  const [activeSection, setActiveSection] = useState(tenantFaqSections[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenantFaqSections;

    return tenantFaqSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q) ||
            item.steps?.some(
              (s) =>
                s.title.toLowerCase().includes(q) ||
                s.detail.toLowerCase().includes(q)
            )
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  const visibleSection =
    filteredSections.find((s) => s.id === activeSection) ?? filteredSections[0];

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Dendukuri&apos;s Residences
            </p>
            <h1 className="text-lg font-bold text-slate-900">Tenant help & FAQ</h1>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"
            >
              Sign in
            </Link>
            <Link
              href="/pay"
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700"
            >
              Pay without login
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <p className="text-sm font-semibold text-emerald-700">TENANT GUIDE</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Daily tasks — step by step
        </h2>
        <p className="mt-2 max-w-2xl text-slate-500">
          How to sign in, pay rent, view receipts, report maintenance, and move
          out. Share this page with all tenants.
        </p>

        <label className="mt-6 block">
          <span className="sr-only">Search help</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — e.g. UTR, receipt, electricity…"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm shadow-sm"
          />
        </label>

        <div className="mt-6">
          <SectionNav
            sections={filteredSections}
            activeId={visibleSection?.id ?? ""}
            onSelect={setActiveSection}
          />
        </div>

        {visibleSection ? (
          <section className="mt-8" id={visibleSection.id}>
            <h3 className="text-xl font-bold text-slate-900">
              {visibleSection.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {visibleSection.description}
            </p>
            <div className="mt-5 space-y-3">
              {visibleSection.items.map((item) => (
                <FaqItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-8 text-sm text-slate-500">No matching topics.</p>
        )}

        <footer className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Still need help?</p>
          <p className="mt-1">
            Contact the property owner with your <strong>flat number</strong>,{" "}
            <strong>billing month</strong>, and <strong>UTR</strong> if payment
            related.
          </p>
          <p className="mt-3">
            <Link href="/login" className="font-semibold text-emerald-700">
              Tenant login
            </Link>
            {" · "}
            <Link href="/pay" className="font-semibold text-emerald-700">
              Pay without login
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
