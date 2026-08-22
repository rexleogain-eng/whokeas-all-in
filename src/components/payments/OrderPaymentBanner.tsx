"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function OrderPaymentBanner() {
  const [pesapalHref, setPesapalHref] = useState("");
  const [selcomHref, setSelcomHref] = useState("");

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

    if (["success", "complete"].includes(paymentState)) {
      return;
    }

    const next = new URLSearchParams();
    next.set("order", orderNumber);

    const key = searchParams.get("key");
    if (key) next.set("key", key);

    const query = next.toString();
    setPesapalHref(`/api/payments/pesapal/start?${query}`);
    setSelcomHref(`/api/payments/selcom/start?${query}`);
  }, []);

  if (!pesapalHref) return null;

  return (
    <div className="border-b border-emerald-800 bg-emerald-700 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-[1580px] flex-wrap items-center justify-center gap-3 sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold">
            Finish your order with secure online payment.
          </p>
          <p className="mt-1 text-[10px] text-emerald-100">
            Pesapal is primary · Selcom is available as backup.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={pesapalHref}
            className="border border-white/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800 hover:bg-emerald-50"
          >
            Pay with Pesapal
          </Link>

          <Link
            href={selcomHref}
            className="border border-white/60 bg-emerald-900/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-emerald-900/50"
          >
            Try Selcom backup
          </Link>
        </div>
      </div>
    </div>
  );
}
