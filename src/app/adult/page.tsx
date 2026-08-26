import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Adult Wellness (18+) | WHOKEAS ALL IN",
  description: "A discreet 18+ wellness department for eligible adult customers.",
  robots: { index: false, follow: true },
};

const departments = [
  ["Personal Wellness", "Adult personal-wellness products"],
  ["Couples Wellness", "Private wellness products for couples"],
  ["Protection", "Condoms and safer-sex essentials"],
  ["Lubricants", "Personal lubricants and related care"],
  ["Intimate Care", "Hygiene and intimate-care essentials"],
  ["Accessories", "Storage, cleaning and wellness accessories"],
];

export default function AdultWellnessPage() {
  return (
    <main className="min-h-screen bg-[#11100f] text-[#f7f2e9]">
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex border border-[#d6bd7b]/60 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#d6bd7b]">18+ Adult Wellness</span>
          <h1 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Private. Discreet. Adult-only.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#cfc4b1]">This department is intended only for adults age 18 or older. Products are kept separate from the general WHOKEAS catalogue and are subject to supplier, shipping, payment-provider and local eligibility requirements.</p>
        </div>

        <div className="mx-auto mt-10 max-w-xl border border-[#d6bd7b]/45 bg-[#1b1916] p-6 text-center shadow-2xl">
          <div className="text-xl font-black">Age confirmation</div>
          <p className="mt-3 text-sm leading-6 text-[#cfc4b1]">By continuing, you confirm that you are at least 18 years old and legally permitted to view adult-wellness products where you live.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href="#departments" className="bg-[#d6bd7b] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#11100f] hover:bg-white">I am 18+ · Continue</a>
            <Link href="/products" className="border border-[#6f675d] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white hover:border-white">Leave this section</Link>
          </div>
        </div>

        <div id="departments" className="mt-20 scroll-mt-28">
          <div className="flex flex-col justify-between gap-4 border-b border-[#413c35] pb-5 sm:flex-row sm:items-end">
            <div><div className="text-xs font-bold uppercase tracking-[0.2em] text-[#d6bd7b]">Browse privately</div><h2 className="mt-2 text-3xl font-black">Adult wellness departments</h2></div>
            <span className="text-xs text-[#a99f91]">Adult inventory will appear here only after eligibility review.</span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map(([title, copy]) => <div key={title} className="border border-[#413c35] bg-[#191714] p-6"><div className="text-lg font-black">{title}</div><p className="mt-2 text-sm leading-6 text-[#bdb3a5]">{copy}</p><div className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6bd7b]">18+ · Coming after catalogue approval</div></div>)}
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[['Discreet experience','Adult items stay out of ordinary product discovery and general recommendations.'],['Channel separated','Adult-only inventory is not intended for the standard Google Merchant product feed.'],['Eligibility first','Checkout availability depends on supplier, destination and payment-provider rules.']].map(([title, copy]) => <div key={title} className="border-t border-[#6f675d] pt-5"><div className="font-black">{title}</div><p className="mt-2 text-sm leading-6 text-[#aaa095]">{copy}</p></div>)}
        </div>
      </section>
    </main>
  );
}
