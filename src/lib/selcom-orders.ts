import { catalogSql } from "@/lib/catalog-schema";
import { syncGrowthOrderStatus } from "@/lib/growth-revenue";
import { getSelcomOrderStatus } from "@/lib/selcom";

function roundMoney(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function reconcileSelcomPayment(orderNumber: string) {
  const normalizedOrderNumber = orderNumber.trim().toUpperCase().slice(0, 40);
  if (!normalizedOrderNumber) {
    throw new Error("Selcom order number is missing.");
  }

  const verified = await getSelcomOrderStatus(normalizedOrderNumber);
  const statusRecord = verified.data?.find(
    (item) => String(item.order_id || "").toUpperCase() === normalizedOrderNumber,
  ) || verified.data?.[0];

  if (!statusRecord) {
    throw new Error("Selcom order status response did not include an order.");
  }

  const sql = catalogSql();
  const rows = await sql`
    SELECT
      payment.id::text AS "paymentId",
      payment.status::text AS "paymentStatus",
      order_record.id::text AS "orderId",
      order_record.order_number AS "orderNumber",
      order_record.status::text AS "orderStatus",
      order_record.total::text AS total,
      order_record.currency AS currency
    FROM orders order_record
    LEFT JOIN LATERAL (
      SELECT id, status
      FROM payments
      WHERE order_id = order_record.id
      ORDER BY created_at DESC
      LIMIT 1
    ) payment ON TRUE
    WHERE order_record.order_number = ${normalizedOrderNumber}
    LIMIT 1
  `;

  const record = rows[0];

  if (!record?.orderId || !record?.paymentId) {
    throw new Error("No WHOKEAS order matches this Selcom order number.");
  }

  const status = String(statusRecord.payment_status || "")
    .trim()
    .toUpperCase();
  const paidAmount = roundMoney(statusRecord.amount);
  const expectedAmount = roundMoney(record.total);
  const raw = JSON.stringify({
    selcomVerification: verified,
    verifiedAt: new Date().toISOString(),
  });

  if (status === "COMPLETED") {
    if (paidAmount + 0.009 < expectedAmount) {
      throw new Error("Selcom payment amount is lower than the order total.");
    }

    if (["cancelled", "refunded"].includes(String(record.orderStatus))) {
      throw new Error("This order can no longer be marked paid automatically.");
    }

    await sql.transaction([
      sql`
        UPDATE payments
        SET
          provider = 'selcom',
          provider_reference = ${String(statusRecord.reference || verified.reference || normalizedOrderNumber)},
          status = 'successful',
          amount = ${paidAmount},
          raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb,
          paid_at = COALESCE(paid_at, NOW())
        WHERE id = ${String(record.paymentId)}
      `,
      sql`
        UPDATE orders
        SET
          status = 'paid',
          updated_at = NOW()
        WHERE id = ${String(record.orderId)}
          AND status::text = 'pending_payment'
      `,
    ]);

    await syncGrowthOrderStatus({
      orderId: String(record.orderId),
      action: "mark_paid",
    });

    return {
      state: "success" as const,
      orderId: String(record.orderId),
      orderNumber: String(record.orderNumber),
      amount: paidAmount,
      currency: String(record.currency || ""),
    };
  }

  if (["CANCELLED", "USERCANCELLED", "USERCANCELED", "REJECTED"].includes(status)) {
    await sql`
      UPDATE payments
      SET
        provider = 'selcom',
        status = 'failed',
        raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
      WHERE id = ${String(record.paymentId)}
    `;

    return {
      state: "failed" as const,
      orderNumber: String(record.orderNumber),
    };
  }

  await sql`
    UPDATE payments
    SET
      provider = 'selcom',
      raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
    WHERE id = ${String(record.paymentId)}
  `;

  return {
    state: "pending" as const,
    orderNumber: String(record.orderNumber),
  };
}
