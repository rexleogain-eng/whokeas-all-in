"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function OrderPaymentBanner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const prefix = "/order-confirmation/";

  if (!pathname.startsWith(prefix)) return null;

  const orderNumber = decodeURIComponent(
    pathname.slice(prefix.length).split("/")[0] || "",
  ).trim();

  if (!orderNumber) return null;

  const paymentState = String(searchParams.get("payment") || "").toLowerCase();

  if (["success", "complete", "local"].includes(paymentState)) {
    return null;
  }

  const next = new URLSearchParams();
  next.set("order", orderNumber);

  const key = searchParams.get("key");
  if (key) next.set("key", key);

  return (
    <div className="border-b border-emerald-800 bg-emerald-700 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-[1580px] flex-wrap items-center justify-center gap-3 sm:justify-between">
        <p className="text-center text-xs font-bold sm:text-left">
          Finish your order with secure card payment.
        </p>

        <Link
          href={`/api/payments/flutterwave/start?${next.toString()}`}
          className="border border-white/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800 hover:bg-emerald-50"
        >
          Pay securely now
        </Link>
      </div>
    </div>
  );
}
