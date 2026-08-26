import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "WHOKEAS Handcrafted Originals",
  description:
    "Preview the WHOKEAS Handcrafted Originals line: small-batch products being developed under the WHOKEAS ALL IN brand.",
  alternates: {
    canonical: `${SITE_URL}/handcrafted`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/handcrafted`,
    siteName: SITE_NAME,
    title: "WHOKEAS Handcrafted Originals",
    description:
      "A transparent preview of small-batch WHOKEAS products now in development.",
  },
};

const concepts = [
  {
    name: "WHOKEAS Hand-Poured Home Candle",
    craft: "Hand-poured",
    detail:
      "A small-batch home fragrance concept planned around a clean vessel, simple labeling and a restrained WHOKEAS look.",
    next: "Wax, fragrance, vessel, safety labeling and production testing",
  },
  {
    name: "WHOKEAS Wooden Desk Valet",
    craft: "Wood-finished",
    detail:
      "A compact desk and bedside organizer concept intended for keys, cards, cables and everyday carry.",
    next: "Material choice, dimensions, finish durability and production capacity",
  },
  {
    name: "WHOKEAS Braided Utility Key Loop",
    craft: "Hand-finished",
    detail:
      "A simple everyday carry accessory concept built around practical hardware, braided cord and small-batch assembly.",
    next: "Cord specification, hardware testing, load testing and final packaging",
  },
] as const;

export default function HandcraftedPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <section className="relative overflow-hidden border-b border-[#2d2923] bg-[#151310] text-white">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:54px_54px]" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d6bd7b]">
            WHOKEAS Originals · Brand-owned line
          </p>
          <h1 className="mt-5 max-w-5xl font-serif text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[88px]">
            Handcrafted products
            <span className="block italic text-[#d6bd7b]">that are actually ours.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-sm leading-8 text-white/65 sm:text-base">
            We are building a small-batch handcrafted line under the WHOKEAS ALL IN brand.
            These concepts are visible now for transparency, but we will not switch on a Buy button
            until real materials, production capacity, product photography, cost and U.S. fulfilment
            have been verified.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/products" className="classic-button-gold">
              Shop available products
            </Link>
            <Link href="/#support" className="classic-button-hero">
              Contact WHOKEAS
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="classic-kicker">First development batch</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
              Three WHOKEAS originals in development.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6b6358]">
            The goal is not to relabel generic supplier products as handcrafted. The products below
            are reserved for genuine WHOKEAS-controlled production or approved small-batch makers.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {concepts.map((concept, index) => (
            <article
              key={concept.name}
              className="border border-[#d7cebf] bg-[#fffdf8] p-7 sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
                  0{index + 1} · {concept.craft}
                </span>
                <span className="border border-[#c9b98f] bg-[#f4ead0] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#73571d]">
                  Prototype
                </span>
              </div>
              <h3 className="mt-8 font-serif text-3xl font-semibold leading-tight">
                {concept.name}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[#6b6358]">{concept.detail}</p>
              <div className="mt-7 border-t border-[#e1d8ca] pt-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8c8275]">
                  Before launch
                </p>
                <p className="mt-2 text-sm leading-6 text-[#4f493f]">{concept.next}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d7cebf] bg-[#ece2d2]">
        <div className="mx-auto grid max-w-[1440px] gap-0 lg:grid-cols-3">
          {[
            ["01", "Real brand ownership", "Products must be designed, assembled, finished or controlled as WHOKEAS originals—not generic imports with a new label."],
            ["02", "Verified economics", "We confirm material cost, labor, packaging and U.S. delivery before setting a public selling price."],
            ["03", "No fake inventory", "A product remains a prototype until stock or made-to-order capacity is genuinely ready to fulfil customer orders."],
          ].map(([number, title, text]) => (
            <div key={number} className="border-b border-[#cfc3af] p-8 lg:border-b-0 lg:border-r lg:p-10 last:lg:border-r-0">
              <p className="text-[10px] font-black tracking-[0.2em] text-[#9b762c]">{number}</p>
              <h3 className="mt-4 font-serif text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#625b50]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#12110f] px-5 py-10 text-center text-sm text-white/55">
        © 2026 WHOKEAS ALL IN · Handcrafted Originals
      </footer>
    </main>
  );
}
