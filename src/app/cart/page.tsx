import type { Metadata } from "next";

import CartClient from "@/components/store/CartClient";
import StoreHeader from "@/components/store/StoreHeader";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shopping Cart",
  alternates: {
    canonical: `${SITE_URL}/cart`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />
      <div className="mx-auto max-w-[1450px] px-4 py-8 sm:px-6 lg:py-12">
        <CartClient />
      </div>
    </main>
  );
}
