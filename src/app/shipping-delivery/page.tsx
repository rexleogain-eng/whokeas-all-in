import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import {
  SHIPPING_POLICY_URL,
  SITE_NAME,
  SITE_URL,
  US_SHIPPING_MAX_DAYS,
  US_SHIPPING_MIN_DAYS,
} from "@/lib/seo";

const SHIPPING_POLICY_ID = `${SHIPPING_POLICY_URL}#policy`;

export const metadata: Metadata = {
  title: "U.S. Shipping and Delivery",
  description:
    `Read ${SITE_NAME}'s free standard U.S. shipping policy and estimated ${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} day delivery window.`,
  alternates: {
    canonical: SHIPPING_POLICY_URL,
  },
  openGraph: {
    type: "website",
    url: SHIPPING_POLICY_URL,
    siteName: SITE_NAME,
    title: `U.S. Shipping and Delivery | ${SITE_NAME}`,
    description:
      `Free standard U.S. shipping with estimated delivery in ${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} days.`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ShippingDeliveryPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": SHIPPING_POLICY_URL,
      name: "U.S. Shipping and Delivery",
      url: SHIPPING_POLICY_URL,
      dateModified: "2026-08-21",
      description:
        `Free standard U.S. shipping with estimated delivery in ${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} days.`,
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      hasShippingService: {
        "@type": "ShippingService",
        "@id": SHIPPING_POLICY_ID,
        name: "Free Standard U.S. Shipping",
        description:
          `Free standard shipping to the United States with an estimated ${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} day delivery window.`,
        fulfillmentType: "https://schema.org/FulfillmentTypeDelivery",
        shippingConditions: {
          "@type": "ShippingConditions",
          shippingDestination: {
            "@type": "DefinedRegion",
            addressCountry: "US",
          },
          shippingRate: {
            "@type": "MonetaryAmount",
            value: 0,
            currency: "USD",
          },
          transitTime: {
            "@type": "ServicePeriod",
            duration: {
              "@type": "QuantitativeValue",
              minValue: US_SHIPPING_MIN_DAYS,
              maxValue: US_SHIPPING_MAX_DAYS,
              unitCode: "DAY",
            },
          },
        },
      },
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <StoreHeader />

      <section className="border-b border-[#d8cfbf] bg-[#171512] text-white">
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d6bd7b]">
            U.S. customer care
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold leading-[0.98] sm:text-7xl">
            Free standard shipping,
            <br />
            explained clearly.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            Products shown as available for U.S. delivery ship at no standard
            shipping charge. The estimated delivery window is {US_SHIPPING_MIN_DAYS}–{US_SHIPPING_MAX_DAYS} days.
          </p>

          <div className="mt-10 grid max-w-3xl gap-px border border-white/15 bg-white/15 sm:grid-cols-3">
            {[
              ["$0", "Standard U.S. shipping"],
              [`${US_SHIPPING_MIN_DAYS}–${US_SHIPPING_MAX_DAYS} days`, "Estimated delivery"],
              ["USD", "Store and checkout currency"],
            ].map(([value, label]) => (
              <div key={label} className="bg-[#171512] p-5">
                <p className="font-serif text-2xl text-[#d6bd7b]">{value}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-12 sm:px-8 lg:grid-cols-3 lg:py-16">
        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
            01 · Cost
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold">
            Free standard shipping
          </h2>
          <p className="mt-5 text-sm leading-7 text-[#625b52]">
            WHOKEAS does not add a standard shipping fee to eligible U.S.
            orders. Product prices and checkout totals are displayed in U.S. dollars.
          </p>
        </section>

        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
            02 · Timing
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold">
            {US_SHIPPING_MIN_DAYS}–{US_SHIPPING_MAX_DAYS} day estimate
          </h2>
          <p className="mt-5 text-sm leading-7 text-[#625b52]">
            The delivery estimate applies after the order and payment are
            confirmed. Product availability and the delivery destination are
            verified during checkout.
          </p>
        </section>

        <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
            03 · Accuracy
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold">
            Check the delivery address
          </h2>
          <p className="mt-5 text-sm leading-7 text-[#625b52]">
            Enter a complete street address, city, state and ZIP code. Address
            corrections can delay fulfilment, so contact WHOKEAS quickly if a
            submitted detail is incorrect.
          </p>
        </section>
      </div>

      <section className="border-y border-[#d8cfbf] bg-[#ebe2d4]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="classic-kicker">Ready to shop?</p>
            <h2 className="mt-2 text-3xl font-normal">Browse products available for U.S. delivery.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="classic-button-dark">
              Shop products
            </Link>
            <Link href="/returns-refunds" className="classic-button-light">
              Returns policy
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#12110f] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-8 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 WHOKEAS ALL IN</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/products" className="hover:text-white">Products</Link>
            <Link href="/shipping-delivery" className="text-[#d6bd7b]">Shipping</Link>
            <Link href="/returns-refunds" className="hover:text-white">Returns</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
