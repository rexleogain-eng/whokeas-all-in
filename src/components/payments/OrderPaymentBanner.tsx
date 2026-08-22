"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function OrderPaymentBanner() {
  const [paymentHref, setPaymentHref] = useState("");

  useEffect(() => {
    const prefix = "/order-confirmation/";
    const pathname = window.location.pathname;

    if (!pathname.startsWith(prefix)) return;

    const orderNumber = decodeURIComponent(
      pathname.slice(prefix.length).split("/")[0] || "",
    ).trim();

    if (!orderNumber) return;

    const searchParams = new URLSearchParams(window.location.search);
    const paymentState = String(searchParams.get("payment") || "").toLowerCase();

    if (["success", "complete", "local"].includes(paymentState)) {
      return;
    }

    const next = new URLSearchParams();
    next.set("order", orderNumber);

    const key = searchParams.get("key");
    if (key) next.set("key", key);

    setPaymentHref(`/api/payments/pesapal/start?${next.toString()}`);
  }, []);

  if (!paymentHref) return null;

  return (
    <div className="border-b border-emerald-800 bg-emerald-700 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-[1580px] flex-wrap items-center justify-center gap-3 sm:justify-between">
        <p className="text-center text-xs font-bold sm:text-left">
          Finish your order with secure card payment.
        </p>

        <Link
          href={paymentHref}
          className="border border-white/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800 hover:bg-emerald-50"
        >
          Pay securely now
        </Link>
      </div>
    </div>
  );
}
