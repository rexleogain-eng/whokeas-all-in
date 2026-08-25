import type { Metadata } from "next";
import Link from "next/link";

import CheckoutClient from "@/components/checkout/CheckoutClient";
import CheckoutCopyPolish from "@/components/checkout/CheckoutCopyPolish";
import CheckoutUsGuard from "@/components/checkout/CheckoutUsGuard";
import StoreHeader from "@/components/store/StoreHeader";
import { SITE_URL, US_RETURN_DAYS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Secure Checkout",
  alternates: {
    canonical: `${SITE_URL}/checkout`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <CheckoutCopyPolish />
      <CheckoutUsGuard />
      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:py-12">
        <section className="mb-6 border border-[#d8cfbf] bg-[#fffdf8] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="classic-kicker">WHOKEAS secure checkout</p>
              <h1 className="mt-2 text-3xl font-normal sm:text-4xl">
                Complete your order with confidence
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6f675c]">
                Your order details are handled through the WHOKEAS checkout. We will never ask you to send card details by email, WhatsApp, text message or chat.
              </p>
            </div>

            <Link
              href="/cart"
              className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a6824] underline underline-offset-4"
            >
              Review cart
            </Link>
          </div>

          <div className="mt-6 grid border-l border-t border-[#ddd4c6] sm:grid-cols-3">
            <div className="border-b border-r border-[#ddd4c6] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b762c]">
                ✓ Direct support
              </p>
              <p className="mt-2 text-sm font-semibold">Help directly from WHOKEAS</p>
            </div>

            <div className="border-b border-r border-[#ddd4c6] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b762c]">
                ✓ Returns
              </p>
              <p className="mt-2 text-sm font-semibold">
                {US_RETURN_DAYS}-day return-request window
              </p>
            </div>

            <div className="border-b border-r border-[#ddd4c6] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b762c]">
                ✓ No card details here
              </p>
              <p className="mt-2 text-sm font-semibold">
                Payment details belong only on the secure payment page
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#746d62]">
            <Link href="/shipping-delivery" className="hover:text-[#9b762c]">
              Shipping policy →
            </Link>
            <Link href="/returns-refunds" className="hover:text-[#9b762c]">
              Returns policy →
            </Link>
          </div>
        </section>

        <CheckoutClient />
      </div>
    </main>
  );
}
