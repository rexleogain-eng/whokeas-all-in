import { NextResponse } from "next/server";

import { catalogSql } from "@/lib/catalog-schema";
import {
  getCustomerSession,
  hashOrderAccessKey,
  safeEqualHex,
} from "@/lib/customer-auth";
import {
  orderEmailConfigured,
  sendOrderConfirmationEmail,
} from "@/lib/order-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orderNumber: string;
  }>;
};

type RequestBody = {
  key?: string;
};

function clean(value: unknown, maximum = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase()
      .slice(0, 40);

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const accessKey = clean(body.key, 200);

    if (!orderNumber) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sql = catalogSql();
    const rows = await sql`
      SELECT
        order_record.id::text AS "orderId",
        order_record.order_number AS "orderNumber",
        order_record.customer_id::text AS "customerId",
        order_record.customer_name AS "customerName",
        order_record.customer_email AS "customerEmail",
        order_record.currency,
        order_record.customer_locale AS locale,
        order_record.total::text AS total,
        order_record.shipping_address AS "shippingAddress",
        order_record.order_access_token_hash AS "accessHash",
        payment.id::text AS "paymentId",
        payment.status::text AS "paymentStatus",
        payment.raw_response AS "rawResponse"
      FROM orders order_record
      LEFT JOIN LATERAL (
        SELECT id, status, raw_response
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
      return NextResponse.json({ ok: false }, { status: 404 });
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
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const rawResponse = (order.rawResponse || {}) as Record<string, unknown>;
    if (rawResponse.orderConfirmationEmailSentAt) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    if (!orderEmailConfigured()) {
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: "email-not-configured",
      });
    }

    const itemRows = await sql`
      SELECT
        product_name AS "productName",
        variant_name AS "variantName",
        quantity::int AS quantity,
        line_total::text AS "lineTotal"
      FROM order_items
      WHERE order_id = ${String(order.orderId)}
      ORDER BY product_name
    `;

    const delivery = (order.shippingAddress || {}) as {
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
      countryName?: string | null;
      countryCode?: string | null;
    };

    const result = await sendOrderConfirmationEmail({
      customerEmail: String(order.customerEmail || ""),
      customerName: String(order.customerName || "Customer"),
      orderNumber: String(order.orderNumber),
      total: Number(order.total || 0),
      currency: String(order.currency || "USD"),
      locale: String(order.locale || "en-US"),
      paymentStatus: String(order.paymentStatus || "pending"),
      accessKey,
      delivery,
      items: itemRows.map((item) => ({
        productName: String(item.productName || "Item"),
        variantName: item.variantName ? String(item.variantName) : null,
        quantity: Number(item.quantity || 1),
        lineTotal: Number(item.lineTotal || 0),
      })),
    });

    if (result.sent) {
      const marker = JSON.stringify({
        orderConfirmationEmailSentAt: new Date().toISOString(),
        orderConfirmationEmailId: result.id || null,
      });

      await sql`
        UPDATE payments
        SET raw_response = COALESCE(raw_response, '{}'::jsonb) || ${marker}::jsonb
        WHERE id = ${String(order.paymentId)}
      `;
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
    });
  }
  catch (error) {
    console.error("Order confirmation email failed:", error);

    return NextResponse.json({
      ok: false,
      sent: false,
      reason: "email-send-failed",
    });
  }
}
