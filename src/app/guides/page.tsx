import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Buyer Guides | WHOKEAS ALL IN",
  description:
    "Practical WHOKEAS buyer guides for portable power, car audio and everyday tech shopping in the United States.",
  alternates: { canonical: `${SITE_URL}/guides` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Buyer Guides | WHOKEAS ALL IN",
    description:
      "Practical buyer guides for portable power, car audio and everyday tech shopping.",
    url: `${SITE_URL}/guides`,
    type: "website",
  },
};

const guides = [
  {
    href: "/guides/digital-display-power-bank-under-30",
    kicker: "Portable power",
    title: "Digital Display Power Bank Under $30",
    text: "What to check before buying: charging ports, useful capacity, display readability, size and everyday value.",
  },
  {
    href: "/guides/bluetooth-fm-transmitter-car-charger",
    kicker: "Car audio",
    title: "Bluetooth FM Transmitter With Car Charger",
    text: "How FM transmitters work, which features matter and what makes one easier to live with in an older car.",
  },
];

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <section className="border-b border-[#d8cfbf] bg-[#171512] px-6 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d6bd7b]">WHOKEAS BUYER GUIDES</p>
          <h1 className="mt-5 text-4xl font-normal tracking-[-0.03em] sm:text-6xl">Buy with a clearer checklist.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            Short, practical guides built around the questions shoppers ask before choosing everyday tech and accessories.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <div className="grid gap-5 md:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="group border border-[#d8cfbf] bg-[#fffdf8] p-7 transition hover:-translate-y-1 hover:border-[#b89a59] hover:shadow-[0_22px_55px_rgba(38,30,20,0.10)]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">{guide.kicker}</p>
              <h2 className="mt-4 text-3xl font-normal leading-tight group-hover:text-[#8a6824]">{guide.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[#746d62]">{guide.text}</p>
              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.15em] text-[#9b762c]">Read guide →</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
