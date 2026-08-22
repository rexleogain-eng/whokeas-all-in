import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { catalogSql } from "@/lib/catalog-schema";
import {
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";
import {
  createPesapalCheckout,
  pesapalConfigured,
} from "@/lib/pesapal";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function confirmationUrl(orderNumber: string, key: string, state?: string) {
  const url = new URL(
    `/order-confirmation/${encodeURIComponent(orderNumber)}`,
    SITE_URL,
  );

  if (key) url.searchParams.set("key", key);
  if (state) url.searchParams.set("payment", state);

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

  const sql = catalogSql();
  const rows = await sql`
    SELECT
      order_record.id::text AS "orderId",
      order_record.order_number AS "orderNumber",
      order_record.customer_id::text AS "customerId",
      order_record.customer_name AS "customerName",
      order_record.customer_phone AS "customerPhone",
      order_record.customer_email AS "customerEmail",
      order_record.status::text AS "orderStatus",
      order_record.currency,
      order_record.total::text AS total,
      order_record.market_country_code AS "countryCode",
      order_record.shipping_address AS "shippingAddress",
      order_record.order_access_token_hash AS "accessHash",
      payment.id::text AS "paymentId",
      payment.provider,
      payment.provider_reference AS "providerReference",
      payment.status::text AS "paymentStatus",
      payment.raw_response AS "rawResponse"
    FROM orders order_record
    LEFT JOIN LATERAL (
      SELECT id, provider, provider_reference, status, raw_response
      FROM payments
      WHERE order_id = order_record.id
      ORDER BY created_at DESC
      LIMIT 1
    ) payment ON TRUE
    WHERE order_record.order_number = ${orderNumber}
    LIMIT 1
  `;

  const order = rows[0];

  if (!order?.orderId || !order?.paymentId) {
    return NextResponse.redirect(
      confirmationUrl(orderNumber, accessKey, "unavailable"),
      303,
    );
  }

  const session = await getCustomerSession();
  const sessionAllowed = Boolean(
    session?.customer.id &&
      order.customerId &&
      session.customer.id === String(order.customerId),
  );
  const keyAllowed = Boolean(
    accessKey &&
      safeEqualHex(
        String(order.accessHash || ""),
        hashOrderAccessKey(accessKey),
      ),
  );

  if (!sessionAllowed && !keyAllowed) {
    return NextResponse.redirect(new URL("/products", SITE_URL), 303);
  }

  if (
    String(order.orderStatus) !== "pending_payment" ||
    String(order.paymentStatus) === "successful"
  ) {
    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "complete"),
      303,
    );
  }

  if (String(order.countryCode || "").toUpperCase() === "TZ") {
    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "local"),
      303,
    );
  }

  if (!pesapalConfigured()) {
    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "setup"),
      303,
    );
  }

  const rawResponse = order.rawResponse as
    | { pesapalCheckout?: { redirect_url?: string } }
    | null;
  const existingRedirect =
    rawResponse?.pesapalCheckout?.redirect_url?.trim() || "";

  if (
    String(order.provider) === "pesapal" &&
    String(order.paymentStatus) === "pending" &&
    existingRedirect
  ) {
    return NextResponse.redirect(existingRedirect, 303);
  }

  const merchantReference = [
    String(order.orderNumber),
    "PES",
    Date.now().toString(36).toUpperCase(),
    randomBytes(2).toString("hex").toUpperCase(),
  ].join("-").slice(0, 50);

  const callback = new URL(
    "/api/payments/pesapal/callback",
    SITE_URL,
  );
  callback.searchParams.set("order", String(order.orderNumber));
  if (accessKey) callback.searchParams.set("key", accessKey);

  const cancellation = confirmationUrl(
    String(order.orderNumber),
    accessKey,
    "cancelled",
  );

  const shipping = (order.shippingAddress || {}) as {
    addressLine1?: string;
    city?: string;
  };

  try {
    const checkout = await createPesapalCheckout({
      merchantReference,
      amount: Number(order.total || 0),
      currency: String(order.currency || "USD"),
      description: `Payment for WHOKEAS order ${String(order.orderNumber)}`,
      callbackUrl: callback.toString(),
      cancellationUrl: cancellation.toString(),
      ipnUrl: new URL("/api/payments/pesapal/ipn", SITE_URL).toString(),
      customerEmail: String(order.customerEmail || ""),
      customerPhone: String(order.customerPhone || ""),
      customerName: String(order.customerName || "WHOKEAS Customer"),
      countryCode: String(order.countryCode || "US"),
      addressLine1: shipping.addressLine1 || null,
      city: shipping.city || null,
    });

    const raw = JSON.stringify({
      pesapalCheckout: checkout.raw,
      pesapalOrderTrackingId: checkout.trackingId,
      pesapalNotificationId: checkout.notificationId,
      checkoutCreatedAt: new Date().toISOString(),
    });

    await sql`
      UPDATE payments
      SET
        provider = 'pesapal',
        provider_reference = ${merchantReference},
        raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
      WHERE id = ${String(order.paymentId)}
    `;

    return NextResponse.redirect(checkout.redirectUrl, 303);
  }
  catch (error) {
    console.error("Pesapal checkout start failed:", error);

    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "error"),
      303,
    );
  }
}
