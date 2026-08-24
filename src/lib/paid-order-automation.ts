import { catalogSql } from "@/lib/catalog-schema";
import {
  ensureCJFulfillmentSchema,
  prepareCJOrder,
  type CJFulfillmentRecord,
} from "@/lib/cj-fulfillment";

export type PaidOrderCJAutomationResult = {
  enabled: boolean;
  submitted: boolean;
  fulfillment: CJFulfillmentRecord | null;
  warning: string | null;
};

function autoOrderEnabled() {
  const value = process.env.CJ_AUTO_ORDER_ENABLED?.trim().toLowerCase();
  if (!value) return true;
  return !["0", "false", "no", "off"].includes(value);
}

export async function autoSubmitPaidOrderToCJ(
  orderNumber: string,
): Promise<PaidOrderCJAutomationResult> {
  if (!autoOrderEnabled()) {
    return {
      enabled: false,
      submitted: false,
      fulfillment: null,
      warning: null,
    };
  }

  try {
    const fulfillment = await prepareCJOrder(orderNumber);
    return {
      enabled: true,
      submitted: Boolean(fulfillment?.cjOrderId),
      fulfillment,
      warning: null,
    };
  } catch (error) {
    const warning =
      error instanceof Error
        ? error.message
        : "The customer payment was confirmed, but automatic CJ order creation failed.";

    console.error(`Automatic CJ submission failed for ${orderNumber}:`, warning);

    return {
      enabled: true,
      submitted: false,
      fulfillment: null,
      warning,
    };
  }
}

export async function recoverPaidOrdersMissingCJ(limit = 10) {
  if (!autoOrderEnabled()) {
    return {
      enabled: false,
      considered: 0,
      submitted: 0,
      failed: 0,
      orders: [] as Array<{
        orderNumber: string;
        submitted: boolean;
        warning: string | null;
      }>,
    };
  }

  await ensureCJFulfillmentSchema();
  const sql = catalogSql();
  const safeLimit = Math.max(1, Math.min(25, Math.floor(limit || 10)));

  const rows = await sql`
    SELECT
      order_record.order_number AS "orderNumber"
    FROM orders order_record
    WHERE order_record.status::text IN ('paid', 'processing')
      AND order_record.updated_at >= NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1
        FROM cj_order_fulfillments fulfillment
        WHERE fulfillment.order_id = order_record.id
      )
      AND EXISTS (
        SELECT 1
        FROM order_items item
        JOIN products product ON product.id = item.product_id
        WHERE item.order_id = order_record.id
          AND LOWER(COALESCE(product.supplier_platform, '')) = 'cj'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM order_items item
        LEFT JOIN products product ON product.id = item.product_id
        WHERE item.order_id = order_record.id
          AND LOWER(COALESCE(product.supplier_platform, '')) <> 'cj'
      )
    ORDER BY order_record.updated_at ASC
    LIMIT ${safeLimit}
  `;

  const report = {
    enabled: true,
    considered: rows.length,
    submitted: 0,
    failed: 0,
    orders: [] as Array<{
      orderNumber: string;
      submitted: boolean;
      warning: string | null;
    }>,
  };

  for (const row of rows) {
    const orderNumber = String(row.orderNumber || "").trim().toUpperCase();
    if (!orderNumber) continue;

    const result = await autoSubmitPaidOrderToCJ(orderNumber);
    if (result.submitted) report.submitted += 1;
    else if (result.warning) report.failed += 1;

    report.orders.push({
      orderNumber,
      submitted: result.submitted,
      warning: result.warning,
    });
  }

  return report;
}
