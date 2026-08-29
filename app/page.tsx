"use client";

import Image from "next/image";
import {
  Building2,
  Car,
  Cctv,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { WHATSAPP_BUSINESS_PHONE_E164 } from "@/lib/whatsapp";

const gallery = [
  { src: "/images/Building.jpg", label: "Building" },
  { src: "/images/1BHK-livingroom-staged.jpg", label: "1BHK Living Room" },
  { src: "/images/1BHK-bedroom-staged.jpg", label: "1BHK Bedroom" },
  { src: "/images/1BHK bathroom.jpg", label: "1BHK Bathroom" },
  { src: "/images/2BHK-livingroom-staged.jpg", label: "2BHK Living Room" },
  { src: "/images/2BHK-living-view-staged.jpg", label: "2BHK Living Area" },
  { src: "/images/2BHK-Kitchenfromlivingroom.jpg", label: "2BHK Kitchen" },
  { src: "/images/2BHK-guestroom-staged.jpg", label: "2BHK Guest Room" },
  { src: "/images/2BKH-balcony&utility.jpg", label: "Balcony & Utility" },
  { src: "/images/terrace.jpg", label: "Terrace" },
];

const amenities = [
  { icon: Car, title: "Vehicle Parking", text: "Dedicated two & four-wheeler parking." },
  { icon: Cctv, title: "CCTV Surveillance", text: "Security monitoring for common areas." },
  { icon: Users, title: "Family Friendly", text: "A peaceful residential environment for families." },
  { icon: ShieldCheck, title: "Well Maintained", text: "Clean, modern and carefully maintained property." },
];

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#home" className="text-lg font-bold tracking-wide text-white sm:text-xl">
            Dendukuri&apos;s <span className="text-emerald-400">Residences</span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#about" className="transition hover:text-white">About</a>
            <a href="#homes" className="transition hover:text-white">Homes</a>
            <a href="#amenities" className="transition hover:text-white">Amenities</a>
            <a href="#gallery" className="transition hover:text-white">Gallery</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </nav>

          <a
            href="#contact"
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Enquire Now
          </a>
        </div>
      </header>

      <section id="home" className="relative min-h-screen overflow-hidden bg-slate-950">
        <Image
          src="/images/Building.jpg"
          alt="Dendukuri's Residences"
          fill
          priority
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/20" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-5 pt-20 lg:px-8">
          <div className="max-w-3xl py-24">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
              <Sparkles size={16} />
              Modern homes for comfortable family living
            </div>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Modern 1BHK & 2BHK
              <span className="block text-emerald-400">homes for rent.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Modern, well-maintained family residences with comfortable interiors,
              dedicated parking and convenient access to the Varthur area.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#homes"
                className="rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-white transition hover:bg-emerald-400"
              >
                Explore Flats
              </a>
              <a
                href="#gallery"
                className="rounded-full border border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                View Gallery
              </a>
              <a
                href="/pay"
                className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-7 py-3.5 font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                Pay rent or dues
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-300">
              <span className="flex items-center gap-2"><Home size={18} className="text-emerald-400" /> 1BHK & 2BHK</span>
              <span className="flex items-center gap-2"><Car size={18} className="text-emerald-400" /> Parking</span>
              <span className="flex items-center gap-2"><Cctv size={18} className="text-emerald-400" /> CCTV</span>
              <span className="flex items-center gap-2"><Users size={18} className="text-emerald-400" /> Families Preferred</span>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image src="/images/terrace.jpg" alt="Dendukuri's Residences terrace" fill className="object-cover" />
          </div>

          <div>
            <p className="font-semibold uppercase tracking-[0.2em] text-emerald-600">Dendukuri&apos;s Residences</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Comfortable living, thoughtfully designed.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              A modern residential property created for families looking for a
              clean, comfortable and well-maintained home. Bright interiors,
              practical layouts and everyday conveniences make settling in easy.
            </p>

            <div className="mt-9 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-5">
                <Building2 className="text-emerald-600" />
                <p className="mt-3 font-semibold">Modern Property</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <MapPin className="text-emerald-600" />
                <p className="mt-3 font-semibold">Convenient Location</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="homes" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-semibold uppercase tracking-[0.2em] text-emerald-600">Choose Your Home</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Flats designed around real life.</h2>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
              <div className="relative aspect-[16/10]">
                <Image src="/images/1BHK-livingroom-staged.jpg" alt="1BHK flat" fill className="object-cover" />
              </div>
              <div className="p-8">
                <p className="text-sm font-semibold text-emerald-600">SMART & COMFORTABLE</p>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <h3 className="text-3xl font-bold">1BHK Residence</h3>
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    ENQUIRE NOW
                  </span>
                </div>

                <p className="mt-4 leading-7 text-slate-600">
                  A practical home with a welcoming living area, comfortable
                  bedroom and thoughtfully planned spaces.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Rent</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">₹12,000</p>
                    <p className="text-xs text-slate-500">+ maintenance</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposit</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">₹50,000</p>
                    <p className="text-xs text-slate-500">security deposit</p>
                  </div>
                </div>

                <a href="#contact" className="mt-7 inline-block font-semibold text-emerald-700">
                  Check availability →
                </a>
              </div>
            </article>

            <article className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
              <div className="relative aspect-[16/10]">
                <Image src="/images/2BHK-living-view-staged.jpg" alt="2BHK flat" fill className="object-cover" />
              </div>
              <div className="p-8">
                <p className="text-sm font-semibold text-emerald-600">SPACIOUS FAMILY HOME</p>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <h3 className="text-3xl font-bold">2BHK Residence</h3>
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    ENQUIRE NOW
                  </span>
                </div>

                <p className="mt-4 leading-7 text-slate-600">
                  More room for family life with spacious living areas, two
                  bedrooms, kitchen and useful utility spaces.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Rent</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">₹20,000</p>
                    <p className="text-xs text-slate-500">+ maintenance</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deposit</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">₹80,000</p>
                    <p className="text-xs text-slate-500">security deposit</p>
                  </div>
                </div>

                <a href="#contact" className="mt-7 inline-block font-semibold text-emerald-700">
                  Check availability →
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="amenities" className="py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <p className="font-semibold uppercase tracking-[0.2em] text-emerald-600">Amenities</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Everything you need for everyday living.</h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {amenities.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-slate-200 p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="gallery" className="bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="font-semibold uppercase tracking-[0.2em] text-emerald-400">Gallery</p>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Take a closer look.</h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((image, index) => (
              <div
                key={image.src}
                className={`group relative overflow-hidden rounded-2xl ${index === 0 ? "sm:col-span-2 lg:col-span-2" : ""} aspect-[4/3]`}
              >
                <Image src={image.src} alt={image.label} fill className="object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16">
                  <p className="font-semibold">{image.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-emerald-700 px-7 py-14 text-center text-white sm:px-14">
            <p className="font-semibold uppercase tracking-[0.2em] text-emerald-200">Looking for a home?</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Schedule a visit to Dendukuri&apos;s Residences.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-emerald-100">
              Contact us for current 1BHK and 2BHK availability, rent details and property visits.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <a
                href="https://www.google.com/maps/place/36,+Dendukuri%E2%80%99s/@12.9141443,77.7504351,17z/data=!3m1!4b1!4m6!3m5!1s0x3bae0d003180c79d:0xa9c918d13a67957b!8m2!3d12.9141391!4d77.7530154!16s%2Fg%2F11nbwvqxgp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white"
              >
                <MapPin size={19} /> Get Directions
              </a>

              <a href={`tel:+${WHATSAPP_BUSINESS_PHONE_E164}`} className="flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-emerald-800">
                <Phone size={19} /> Call Now
              </a>
              <a href={`https://wa.me/${WHATSAPP_BUSINESS_PHONE_E164}?text=Hi%2C%20I%27m%20interested%20in%20renting%20a%20flat%20at%20Dendukuri%27s%20Residences.%20Please%20share%20the%20current%20availability.`} className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white">
                <MessageCircle size={19} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="font-semibold text-slate-800">Dendukuri&apos;s Residences</p>
          <div className="flex flex-wrap items-center gap-4">
            <p>Comfortable homes for modern families.</p>
            <a href="/pay" className="font-medium text-emerald-700 hover:text-emerald-800">
              Pay without login
            </a>
            <a href="/login?as=tenant" className="font-medium text-emerald-700 hover:text-emerald-800">
              Owner / tenant login
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
