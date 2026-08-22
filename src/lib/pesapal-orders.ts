import { catalogSql } from "@/lib/catalog-schema";
import { syncGrowthOrderStatus } from "@/lib/growth-revenue";
import { getPesapalTransactionStatus } from "@/lib/pesapal";

function roundMoney(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function reconcilePesapalPayment(input: {
  orderTrackingId: string;
  expectedMerchantReference?: string | null;
}) {
  const verified = await getPesapalTransactionStatus(input.orderTrackingId);
  const merchantReference = String(verified.merchant_reference || "").trim();

  if (!merchantReference) {
    throw new Error("Pesapal merchant reference is missing.");
  }

  if (
    input.expectedMerchantReference &&
    merchantReference !== input.expectedMerchantReference
  ) {
    throw new Error("Pesapal merchant reference does not match.");
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
    FROM payments payment
    JOIN orders order_record
      ON order_record.id = payment.order_id
    WHERE payment.provider_reference = ${merchantReference}
    ORDER BY payment.created_at DESC
    LIMIT 1
  `;

  const record = rows[0];

  if (!record?.orderId || !record?.paymentId) {
    throw new Error("No WHOKEAS order matches this Pesapal payment reference.");
  }

  const status = String(verified.payment_status_description || "")
    .trim()
    .toUpperCase();
  const paidAmount = roundMoney(verified.amount);
  const expectedAmount = roundMoney(record.total);
  const paidCurrency = String(verified.currency || "").toUpperCase();
  const expectedCurrency = String(record.currency || "").toUpperCase();

  const raw = JSON.stringify({
    pesapalVerification: verified,
    pesapalOrderTrackingId: input.orderTrackingId,
    verifiedAt: new Date().toISOString(),
  });

  if (status === "COMPLETED") {
    if (paidCurrency !== expectedCurrency) {
      throw new Error("Pesapal payment currency does not match the order.");
    }

    if (paidAmount + 0.009 < expectedAmount) {
      throw new Error("Pesapal payment amount is lower than the order total.");
    }

    if (["cancelled", "refunded"].includes(String(record.orderStatus))) {
      throw new Error("This order can no longer be marked paid automatically.");
    }

    await sql.transaction([
      sql`
        UPDATE payments
        SET
          provider = 'pesapal',
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
      merchantReference,
      amount: paidAmount,
      currency: paidCurrency,
    };
  }

  if (status === "REVERSED") {
    await sql.transaction([
      sql`
        UPDATE payments
        SET
          provider = 'pesapal',
          status = 'refunded',
          raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
        WHERE id = ${String(record.paymentId)}
      `,
      sql`
        UPDATE orders
        SET
          status = 'refunded',
          updated_at = NOW()
        WHERE id = ${String(record.orderId)}
          AND status::text IN ('pending_payment', 'paid', 'processing')
      `,
    ]);

    return {
      state: "reversed" as const,
      orderNumber: String(record.orderNumber),
      merchantReference,
    };
  }

  if (["FAILED", "INVALID"].includes(status)) {
    await sql`
      UPDATE payments
      SET
        provider = 'pesapal',
        status = 'failed',
        raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
      WHERE id = ${String(record.paymentId)}
    `;

    return {
      state: "failed" as const,
      orderNumber: String(record.orderNumber),
      merchantReference,
    };
  }

  await sql`
    UPDATE payments
    SET
      provider = 'pesapal',
      raw_response = COALESCE(raw_response, '{}'::jsonb) || ${raw}::jsonb
    WHERE id = ${String(record.paymentId)}
  `;

  return {
    state: "pending" as const,
    orderNumber: String(record.orderNumber),
    merchantReference,
  };
}
