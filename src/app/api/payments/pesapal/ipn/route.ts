import { NextResponse } from "next/server";

import { reconcilePesapalPayment } from "@/lib/pesapal-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(orderTrackingId: string, merchantReference: string) {
  if (!orderTrackingId) {
    return NextResponse.json(
      {
        orderNotificationType: "IPNCHANGE",
        orderTrackingId: "",
        orderMerchantReference: merchantReference,
        status: 500,
      },
      { status: 400 },
    );
  }

  try {
    await reconcilePesapalPayment({
      orderTrackingId,
      expectedMerchantReference: merchantReference || null,
    });

    return NextResponse.json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference: merchantReference,
      status: 200,
    });
  }
  catch (error) {
    console.error("Pesapal IPN reconciliation failed:", error);

    return NextResponse.json(
      {
        orderNotificationType: "IPNCHANGE",
        orderTrackingId,
        orderMerchantReference: merchantReference,
        status: 500,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  return handle(
    String(url.searchParams.get("OrderTrackingId") || "").trim(),
    String(url.searchParams.get("OrderMerchantReference") || "").trim(),
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let orderTrackingId = "";
  let merchantReference = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    orderTrackingId = String(body.OrderTrackingId || body.orderTrackingId || "").trim();
    merchantReference = String(
      body.OrderMerchantReference || body.orderMerchantReference || "",
    ).trim();
  }
  else {
    const text = await request.text();
    const params = new URLSearchParams(text);
    orderTrackingId = String(params.get("OrderTrackingId") || "").trim();
    merchantReference = String(
      params.get("OrderMerchantReference") || "",
    ).trim();
  }

  return handle(orderTrackingId, merchantReference);
}
