import { NextResponse } from "next/server";

import { settleFlutterwavePayment } from "@/lib/flutterwave-orders";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function confirmationUrl(orderNumber: string, key: string, state: string) {
  const url = new URL(
    `/order-confirmation/${encodeURIComponent(orderNumber)}`,
    SITE_URL,
  );

  if (key) url.searchParams.set("key", key);
  url.searchParams.set("payment", state);
  return url;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const fallbackOrder = String(incoming.searchParams.get("order") || "")
    .trim()
    .toUpperCase()
    .slice(0, 40);
  const accessKey = String(incoming.searchParams.get("key") || "")
    .trim()
    .slice(0, 200);
  const status = String(incoming.searchParams.get("status") || "")
    .trim()
    .toLowerCase();
  const transactionId = String(
    incoming.searchParams.get("transaction_id") || "",
  ).trim();
  const txRef = String(incoming.searchParams.get("tx_ref") || "").trim();

  if (!transactionId || (status && status !== "successful")) {
    return NextResponse.redirect(
      confirmationUrl(fallbackOrder || "unknown", accessKey, "failed"),
      303,
    );
  }

  try {
    const settled = await settleFlutterwavePayment({
      transactionId,
      expectedTxRef: txRef || null,
    });

    return NextResponse.redirect(
      confirmationUrl(settled.orderNumber, accessKey, "success"),
      303,
    );
  }
  catch (error) {
    console.error("Flutterwave callback verification failed:", error);

    return NextResponse.redirect(
      confirmationUrl(fallbackOrder || "unknown", accessKey, "verification-error"),
      303,
    );
  }
}
