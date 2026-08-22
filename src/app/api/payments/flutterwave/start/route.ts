import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { catalogSql } from "@/lib/catalog-schema";
import {
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";
import {
  createFlutterwaveCheckout,
  flutterwaveConfigured,
} from "@/lib/flutterwave";
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
      order_record.order_access_token_hash AS "accessHash",
      payment.id::text AS "paymentId",
      payment.status::text AS "paymentStatus"
    FROM orders order_record
    LEFT JOIN LATERAL (
      SELECT id, status
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

  if (!flutterwaveConfigured()) {
    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "setup"),
      303,
    );
  }

  const txRef = [
    String(order.orderNumber),
    "FLW",
    Date.now().toString(36).toUpperCase(),
    randomBytes(3).toString("hex").toUpperCase(),
  ].join("-");

  const callback = new URL(
    "/api/payments/flutterwave/callback",
    SITE_URL,
  );
  callback.searchParams.set("order", String(order.orderNumber));
  if (accessKey) callback.searchParams.set("key", accessKey);

  try {
    const checkout = await createFlutterwaveCheckout({
      txRef,
      amount: Number(order.total || 0),
      currency: String(order.currency || "USD"),
      customerEmail: String(order.customerEmail || ""),
      customerName: String(order.customerName || "WHOKEAS Customer"),
      customerPhone: String(order.customerPhone || ""),
      redirectUrl: callback.toString(),
      orderNumber: String(order.orderNumber),
    });

    const raw = JSON.stringify({
      flutterwaveCheckout: checkout.raw,
      flutterwaveTxRef: txRef,
      checkoutCreatedAt: new Date().toISOString(),
    });

    await sql`
      UPDATE payments
      SET
        provider = 'flutterwave',
        provider_reference = ${txRef},
        raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
      WHERE id = ${String(order.paymentId)}
    `;

    return NextResponse.redirect(checkout.link, 303);
  }
  catch (error) {
    console.error("Flutterwave checkout start failed:", error);

    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "error"),
      303,
    );
  }
}
