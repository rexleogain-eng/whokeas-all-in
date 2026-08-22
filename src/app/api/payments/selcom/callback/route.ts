import { NextResponse } from "next/server";

import { reconcileSelcomPayment } from "@/lib/selcom-orders";
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
  const orderNumber = String(incoming.searchParams.get("order") || "")
    .trim()
    .toUpperCase()
    .slice(0, 40);
  const accessKey = String(incoming.searchParams.get("key") || "")
    .trim()
    .slice(0, 200);

  if (!orderNumber) {
    return NextResponse.redirect(new URL("/products", SITE_URL), 303);
  }

  try {
    const result = await reconcileSelcomPayment(orderNumber);
    return NextResponse.redirect(
      confirmationUrl(result.orderNumber, accessKey, result.state),
      303,
    );
  }
  catch (error) {
    console.error("Selcom callback verification failed:", error);
    return NextResponse.redirect(
      confirmationUrl(orderNumber, accessKey, "selcom-verification-error"),
      303,
    );
  }
}
