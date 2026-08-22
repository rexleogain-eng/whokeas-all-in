import { NextResponse } from "next/server";

import { reconcilePesapalPayment } from "@/lib/pesapal-orders";
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
  const orderTrackingId = String(
    incoming.searchParams.get("OrderTrackingId") || "",
  ).trim();
  const merchantReference = String(
    incoming.searchParams.get("OrderMerchantReference") || "",
  ).trim();

  if (!orderTrackingId) {
    return NextResponse.redirect(
      confirmationUrl(fallbackOrder || "unknown", accessKey, "failed"),
      303,
    );
  }

  try {
    const result = await reconcilePesapalPayment({
      orderTrackingId,
      expectedMerchantReference: merchantReference || null,
    });

    return NextResponse.redirect(
      confirmationUrl(result.orderNumber, accessKey, result.state),
      303,
    );
  }
  catch (error) {
    console.error("Pesapal callback verification failed:", error);

    return NextResponse.redirect(
      confirmationUrl(
        fallbackOrder || "unknown",
        accessKey,
        "verification-error",
      ),
      303,
    );
  }
}
