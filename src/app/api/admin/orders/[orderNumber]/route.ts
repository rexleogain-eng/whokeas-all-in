import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  syncGrowthOrderStatus,
} from "@/lib/growth-revenue";
import { autoSubmitPaidOrderToCJ } from "@/lib/paid-order-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = {
  params: Promise<{ orderNumber: string }>;
};

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
    let growthWarning: string | null = null;

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

      const cjAutomation = await autoSubmitPaidOrderToCJ(orderNumber);
      cjFulfillment = cjAutomation.fulfillment;
      cjWarning = cjAutomation.warning;
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

    try {
      await syncGrowthOrderStatus({
        orderId: String(order.id),
        action:
          action as
            | "mark_paid"
            | "mark_processing"
            | "mark_shipped"
            | "mark_delivered"
            | "cancel",
      });
    }
    catch (error) {
      growthWarning =
        error instanceof Error
          ? error.message
          : "Order updated, but Growth & Revenue synchronization failed.";
    }

    return NextResponse.json({
      ok: true,
      cjFulfillment,
      cjWarning,
      growthWarning,
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
