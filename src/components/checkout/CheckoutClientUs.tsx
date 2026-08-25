"use client";

import dynamic from "next/dynamic";

const CheckoutClient = dynamic(
  () => import("@/components/checkout/CheckoutClient"),
  {
    ssr: false,
    loading: () => (
      <div className="border border-[#d8cfbf] bg-[#fffdf8] p-8">
        Preparing U.S. checkout…
      </div>
    ),
  },
);

export default function CheckoutClientUs() {
  return <CheckoutClient />;
}
