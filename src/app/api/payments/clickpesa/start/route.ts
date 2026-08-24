import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { catalogSql } from "@/lib/catalog-schema";
import {
  clickPesaConfigured,
  createClickPesaCheckout,
} from "@/lib/clickpesa";
import {
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function confirmationUrl(
  orderNumber: string,
  key: string,
  state?: string,
) {
  const url = new URL(
    `/order-confirmation/${encodeURIComponent(orderNumber)}`,
    SITE_URL,
  );

  if (key) url.searchParams.set("key", key);
  if (state) url.searchParams.set("payment", state);

  return url;
}

function clickPesaReference(orderNumber: string) {
  const order = orderNumber.replace(/[^A-Za-z0-9]/g, "");
  const nonce = randomBytes(3).toString("hex").toUpperCase();

  return `${order}CP${Date.now().toString(36).toUpperCase()}${nonce}`
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 50);
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);

  const orderNumber = String(
    incoming.searchParams.get("order") || "",
  )
    .trim()
    .toUpperCase()
    .slice(0, 40);

  const accessKey = String(
    incoming.searchParams.get("key") || "",
  )
    .trim()
    .slice(0, 200);

  if (!orderNumber) {
    return NextResponse.redirect(
      new URL("/products", SITE_URL),
      303,
    );
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
      payment.provider,
      payment.provider_reference AS "providerReference",
      payment.status::text AS "paymentStatus",
      payment.raw_response AS "rawResponse"
    FROM orders order_record
    LEFT JOIN LATERAL (
      SELECT
        id,
        provider,
        provider_reference,
        status,
        raw_response
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
      confirmationUrl(
        orderNumber,
        accessKey,
        "unavailable",
      ),
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
    return NextResponse.redirect(
      new URL("/products", SITE_URL),
      303,
    );
  }

  if (
    String(order.orderStatus) !== "pending_payment" ||
    String(order.paymentStatus) === "successful"
  ) {
    return NextResponse.redirect(
      confirmationUrl(
        String(order.orderNumber),
        accessKey,
        "complete",
      ),
      303,
    );
  }

  if (
    String(order.countryCode).toUpperCase() !== "US" ||
    String(order.currency).toUpperCase() !== "USD"
  ) {
    return NextResponse.redirect(
      confirmationUrl(
        String(order.orderNumber),
        accessKey,
        "unavailable",
      ),
      303,
    );
  }

  if (!clickPesaConfigured()) {
    return NextResponse.redirect(
      confirmationUrl(
        String(order.orderNumber),
        accessKey,
        "setup",
      ),
      303,
    );
  }

  const rawResponse = order.rawResponse as
    | {
        clickPesaCheckout?: {
          checkoutLink?: string;
        };
      }
    | null;

  const existingRedirect =
    rawResponse?.clickPesaCheckout?.checkoutLink?.trim() || "";

  if (
    String(order.provider) === "clickpesa" &&
    String(order.paymentStatus) === "pending" &&
    existingRedirect
  ) {
    return NextResponse.redirect(
      existingRedirect,
      303,
    );
  }

  const providerReference = clickPesaReference(
    String(order.orderNumber),
  );

  // Save the provider and reference before creating the hosted session so
  // every later callback can be reconciled to exactly one WHOKEAS order.
  await sql`
    UPDATE payments
    SET
      provider = 'clickpesa',
      provider_reference = ${providerReference}
    WHERE id = ${String(order.paymentId)}
  `;

  try {
    const checkout = await createClickPesaCheckout({
      orderReference: providerReference,
      amount: Number(order.total || 0),
      currency: String(order.currency || "USD"),
      customerName: String(
        order.customerName || "WHOKEAS Customer",
      ),
      customerEmail: String(order.customerEmail || ""),
      customerPhone: String(order.customerPhone || ""),
      description: `WHOKEAS order ${String(order.orderNumber)}`,
      callbackUrl: new URL(
        "/api/payments/clickpesa/webhook",
        SITE_URL,
      ).toString(),
    });

    const raw = JSON.stringify({
      clickPesaCheckout: {
        checkoutLink: checkout.checkoutLink,
        clientId: checkout.clientId,
        createdAt: new Date().toISOString(),
      },
    });

    await sql`
      UPDATE payments
      SET
        provider = 'clickpesa',
        provider_reference = ${providerReference},
        raw_response =
          COALESCE(raw_response, '{}'::jsonb) ||
          ${raw}::jsonb
      WHERE id = ${String(order.paymentId)}
    `;

    return NextResponse.redirect(
      checkout.checkoutLink,
      303,
    );
  }
  catch (error) {
    console.error(
      "ClickPesa checkout start failed:",
      error,
    );

    return NextResponse.redirect(
      confirmationUrl(
        String(order.orderNumber),
        accessKey,
        "error",
      ),
      303,
    );
  }
}
