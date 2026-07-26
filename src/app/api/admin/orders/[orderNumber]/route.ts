import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { prepareCJOrder } from "@/lib/cj-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = {
  params: Promise<{ orderNumber: string }>;
};

function autoOrderEnabled() {
  const value = process.env.CJ_AUTO_ORDER_ENABLED?.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(String(value || ""));
}

export async function PATCH(request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();

    const body = (await request.json()) as { action?: string };
    const action = body.action ?? "";
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id
      FROM orders
      WHERE order_number = ${orderNumber}
      LIMIT 1
    `;

    const order = rows[0];

    if (!order?.id) {
      return NextResponse.json(
        { ok: false, error: "Order not found." },
        { status: 404 },
      );
    }

    let cjFulfillment: unknown = null;
    let cjWarning: string | null = null;

    if (action === "mark_paid") {
      await sql.transaction([
        sql`
          UPDATE payments
          SET status = 'successful', paid_at = NOW()
          WHERE order_id = ${order.id}
        `,
        sql`
          UPDATE orders
          SET status = 'paid', updated_at = NOW()
          WHERE id = ${order.id}
        `,
      ]);

      if (autoOrderEnabled()) {
        try {
          cjFulfillment = await prepareCJOrder(orderNumber);
        } catch (error) {
          cjWarning =
            error instanceof Error
              ? error.message
              : "The customer payment was saved, but CJ order creation failed.";
        }
      }
    } else if (action === "mark_processing") {
      await sql`
        UPDATE orders
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${order.id}
      `;
    } else if (action === "mark_shipped") {
      await sql`
        UPDATE orders
        SET status = 'shipped', updated_at = NOW()
        WHERE id = ${order.id}
      `;
    } else if (action === "mark_delivered") {
      await sql.transaction([
        sql`
          UPDATE orders
          SET status = 'delivered', updated_at = NOW()
          WHERE id = ${order.id}
        `,
        sql`
          UPDATE payments
          SET
            status = CASE
              WHEN provider = 'cash_on_delivery' THEN 'successful'
              ELSE status
            END,
            paid_at = CASE
              WHEN provider = 'cash_on_delivery' THEN NOW()
              ELSE paid_at
            END
          WHERE order_id = ${order.id}
        `,
      ]);
    } else if (action === "cancel") {
      await sql.transaction([
        sql`
          UPDATE orders
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = ${order.id}
        `,
        sql`
          UPDATE payments
          SET status = 'failed'
          WHERE order_id = ${order.id}
            AND status = 'pending'
        `,
      ]);
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid action." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      cjFulfillment,
      cjWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Update failed.",
      },
      { status: 500 },
    );
  }
}
