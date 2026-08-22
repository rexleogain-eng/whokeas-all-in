import type { Metadata } from "next";
import Link from "next/link";

import ArticleStructuredData from "@/components/seo/ArticleStructuredData";
import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreProducts } from "@/lib/store-catalog";
import { storefrontFocusScore } from "@/lib/store-copy";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GUIDE_PATH = "/guides/digital-display-power-bank-under-30";
const GUIDE_TITLE = "Digital Display Power Bank Under $30: What to Check Before You Buy";
const GUIDE_DESCRIPTION =
  "A practical guide to choosing a digital display power bank under $30, including charging ports, capacity, size, display usefulness and value.";
const GUIDE_DATE = "2026-08-22T00:00:00.000Z";

export const metadata: Metadata = {
  title: "Digital Display Power Bank Under $30 | WHOKEAS Buyer Guide",
  description: GUIDE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${GUIDE_PATH}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Digital Display Power Bank Under $30 | WHOKEAS Buyer Guide",
    description:
      "What to check before choosing a budget digital display power bank for everyday charging and travel.",
    url: `${SITE_URL}${GUIDE_PATH}`,
    type: "article",
  },
};

export default async function DigitalDisplayPowerBankGuide() {
  const products = await getStoreProducts({ query: "power bank", limit: 18, sort: "newest" });
  const picks = products
    .filter((product) => /power\s*bank/i.test(String(product.name || "")))
    .filter((product) => Number(product.price || 0) > 0 && Number(product.price) <= 30)
    .sort((a, b) => storefrontFocusScore(b) - storefrontFocusScore(a))
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <ArticleStructuredData
        title={GUIDE_TITLE}
        description={GUIDE_DESCRIPTION}
        path={GUIDE_PATH}
        datePublished={GUIDE_DATE}
        dateModified={GUIDE_DATE}
        imageUrl={picks[0]?.image || null}
      />

      <article>
        <header className="border-b border-[#d8cfbf] bg-[#171512] px-6 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d6bd7b]">WHOKEAS BUYER GUIDE · PORTABLE POWER</p>
            <h1 className="mt-5 text-4xl font-normal leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              {GUIDE_TITLE}
            </h1>
            <p className="mt-6 max-w-3xl text-sm leading-8 text-white/70 sm:text-base">
              A low price is useful only when the charger also fits your routine. The best budget choice is the one that balances readable battery information, practical ports, useful capacity, size and delivery time.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
          <section className="space-y-5 text-sm leading-8 text-[#5f584d] sm:text-base">
            <h2 className="text-3xl font-normal text-[#1d1914]">Why the digital display matters</h2>
            <p>
              A percentage display is more useful than a few indicator lights because it gives you a clearer idea of how much charge remains. That helps when deciding whether the power bank needs to be recharged before a commute, long day out or trip.
            </p>
            <p>
              The display does not make a power bank better by itself. Charging speed, capacity, ports, build quality and device compatibility still matter more than the screen.
            </p>
          </section>

          <section className="mt-12 border-y border-[#d8cfbf] py-10">
            <h2 className="text-3xl font-normal">Five things to compare</h2>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {[
                ["1. Capacity", "Choose enough reserve power for your normal day without buying a battery that is much larger and heavier than you need."],
                ["2. USB-C support", "USB-C input and output can make charging simpler, especially if your phone, tablet or earbuds already use USB-C."],
                ["3. Charging output", "Look for clearly stated output specifications. Faster charging is useful, but only when your device supports the same charging standard."],
                ["4. Size and weight", "A slim or compact power bank is easier to keep in a pocket, small bag or daily carry setup."],
                ["5. Display readability", "The battery percentage should be easy to read at a glance rather than hidden behind a tiny or overly bright screen."],
              ].map(([title, text]) => (
                <div key={title} className="border border-[#d8cfbf] bg-[#fffdf8] p-5">
                  <h3 className="text-lg font-normal text-[#1d1914]">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#746d62]">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 space-y-5 text-sm leading-8 text-[#5f584d] sm:text-base">
            <h2 className="text-3xl font-normal text-[#1d1914]">What to expect below $30</h2>
            <p>
              In this price range, focus on useful everyday features rather than extreme capacity claims. A straightforward charger with a clear display, sensible size and dependable ports is usually more valuable than a product that promises every possible feature at once.
            </p>
            <p>
              If you plan to fly with a power bank, check the current airline and airport rules before travel. Battery policies can change, and the product label should make its capacity information easy to verify.
            </p>
          </section>

          {picks.length > 0 && (
            <section className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">CURRENT WHOKEAS OPTIONS</p>
                  <h2 className="mt-3 text-3xl font-normal">Power banks currently at or below $30</h2>
                </div>
                <Link href="/shop/portable-power-banks" className="classic-button-light">See all power banks</Link>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
                {picks.map((product) => (
                  <StoreProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-14 border border-[#c9b98f] bg-[#fffdf8] p-7 sm:p-9">
            <h2 className="text-2xl font-normal">The simple decision rule</h2>
            <p className="mt-4 text-sm leading-7 text-[#746d62]">
              Pick the smallest power bank that gives you enough reserve charge, has the ports your devices actually use, shows battery level clearly and fits your budget without relying on exaggerated specifications.
            </p>
            <Link href="/shop/portable-power-banks" className="mt-7 inline-block text-xs font-bold uppercase tracking-[0.14em] text-[#8a6824] hover:text-[#171512]">
              Shop portable power banks →
            </Link>
          </section>
        </div>
      </article>
    </main>
  );
}
