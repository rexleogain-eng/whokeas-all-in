import { NextResponse } from "next/server";

import { catalogSql } from "@/lib/catalog-schema";
import {
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";
import { createSelcomCheckout, selcomConfigured } from "@/lib/selcom";
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
      payment.status::text AS "paymentStatus",
      payment.raw_response AS "rawResponse",
      item_count.quantity::int AS "itemCount"
    FROM orders order_record
    LEFT JOIN LATERAL (
      SELECT id, provider, status, raw_response
      FROM payments
      WHERE order_id = order_record.id
      ORDER BY created_at DESC
      LIMIT 1
    ) payment ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM order_items
      WHERE order_id = order_record.id
    ) item_count ON TRUE
    WHERE order_record.order_number = ${orderNumber}
    LIMIT 1
  `;

  const order = rows[0];

  if (!order?.orderId || !order?.paymentId) {
    return NextResponse.redirect(
      confirmationUrl(orderNumber, accessKey, "selcom-unavailable"),
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

  if (!selcomConfigured()) {
    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "selcom-setup"),
      303,
    );
  }

  const rawResponse = order.rawResponse as
    | { selcomCheckout?: { paymentGatewayUrl?: string } }
    | null;
  const existingRedirect = rawResponse?.selcomCheckout?.paymentGatewayUrl?.trim() || "";

  if (
    String(order.provider) === "selcom" &&
    String(order.paymentStatus) === "pending" &&
    /^https?:\/\//i.test(existingRedirect)
  ) {
    return NextResponse.redirect(existingRedirect, 303);
  }

  const shipping = (order.shippingAddress || {}) as {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    countryCode?: string;
  };

  const callback = new URL("/api/payments/selcom/callback", SITE_URL);
  callback.searchParams.set("order", String(order.orderNumber));
  if (accessKey) callback.searchParams.set("key", accessKey);

  const cancellation = confirmationUrl(
    String(order.orderNumber),
    accessKey,
    "cancelled",
  );

  try {
    const checkout = await createSelcomCheckout({
      orderId: String(order.orderNumber),
      amount: Number(order.total || 0),
      currency: String(order.currency || "USD"),
      customerEmail: String(order.customerEmail || ""),
      customerName: String(order.customerName || "WHOKEAS Customer"),
      customerPhone: String(order.customerPhone || ""),
      redirectUrl: callback.toString(),
      cancelUrl: cancellation.toString(),
      webhookUrl: new URL("/api/payments/selcom/webhook", SITE_URL).toString(),
      addressLine1: String(shipping.addressLine1 || "Delivery address"),
      addressLine2: shipping.addressLine2 || null,
      city: String(shipping.city || "City"),
      region: shipping.region || null,
      postalCode: shipping.postalCode || null,
      countryCode: String(order.countryCode || shipping.countryCode || "US"),
      noOfItems: Number(order.itemCount || 1),
    });

    const raw = JSON.stringify({
      selcomCheckout: {
        paymentGatewayUrl: checkout.gatewayUrl,
        reference: checkout.reference,
        gatewayBuyerUuid: checkout.gatewayBuyerUuid,
        paymentToken: checkout.paymentToken,
      },
      selcomRaw: checkout.raw,
      checkoutCreatedAt: new Date().toISOString(),
    });

    await sql`
      UPDATE payments
      SET
        provider = 'selcom',
        provider_reference = ${String(order.orderNumber)},
        raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
      WHERE id = ${String(order.paymentId)}
    `;

    return NextResponse.redirect(checkout.gatewayUrl, 303);
  }
  catch (error) {
    console.error("Selcom checkout start failed:", error);

    return NextResponse.redirect(
      confirmationUrl(String(order.orderNumber), accessKey, "selcom-error"),
      303,
    );
  }
}
