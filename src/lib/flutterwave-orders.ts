import { catalogSql } from "@/lib/catalog-schema";
import { syncGrowthOrderStatus } from "@/lib/growth-revenue";
import { verifyFlutterwaveTransaction } from "@/lib/flutterwave";

function roundMoney(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function settleFlutterwavePayment(input: {
  transactionId: string | number;
  expectedTxRef?: string | null;
}) {
  const verified = await verifyFlutterwaveTransaction(input.transactionId);
  const txRef = String(verified.tx_ref || "").trim();

  if (!txRef) {
    throw new Error("Flutterwave transaction reference is missing.");
  }

  if (input.expectedTxRef && txRef !== input.expectedTxRef) {
    throw new Error("Flutterwave transaction reference does not match.");
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
    WHERE payment.provider_reference = ${txRef}
    ORDER BY payment.created_at DESC
    LIMIT 1
  `;

  const record = rows[0];

  if (!record?.orderId || !record?.paymentId) {
    throw new Error("No WHOKEAS order matches this payment reference.");
  }

  const expectedAmount = roundMoney(record.total);
  const paidAmount = roundMoney(verified.amount);
  const expectedCurrency = String(record.currency || "").toUpperCase();
  const paidCurrency = String(verified.currency || "").toUpperCase();
  const paymentStatus = String(verified.status || "").toLowerCase();

  if (paymentStatus !== "successful") {
    throw new Error("Flutterwave has not confirmed this payment as successful.");
  }

  if (paidCurrency !== expectedCurrency) {
    throw new Error("Flutterwave payment currency does not match the order.");
  }

  if (paidAmount + 0.009 < expectedAmount) {
    throw new Error("Flutterwave payment amount is lower than the order total.");
  }

  if (["cancelled", "refunded"].includes(String(record.orderStatus))) {
    throw new Error("This order can no longer be marked paid automatically.");
  }

  const providerReference = String(
    verified.flw_ref || verified.id || txRef,
  ).slice(0, 180);
  const fee = roundMoney(verified.app_fee || verified.merchant_fee || 0);
  const raw = JSON.stringify({
    flutterwaveVerification: verified,
    verifiedAt: new Date().toISOString(),
  });

  await sql.transaction([
    sql`
      UPDATE payments
      SET
        provider = 'flutterwave',
        provider_reference = ${txRef},
        status = 'successful',
        amount = ${paidAmount},
        fee = ${fee},
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
    orderId: String(record.orderId),
    orderNumber: String(record.orderNumber),
    txRef,
    providerReference,
    amount: paidAmount,
    currency: paidCurrency,
  };
}
