import { catalogSql } from "@/lib/catalog-schema";
import {
  getClickPesaPaymentStatus,
} from "@/lib/clickpesa";
import { syncGrowthOrderStatus } from "@/lib/growth-revenue";
import { autoSubmitPaidOrderToCJ } from "@/lib/paid-order-automation";

function roundMoney(value: unknown) {
  return Math.round(
    (Number(value || 0) + Number.EPSILON) * 100,
  ) / 100;
}

export async function reconcileClickPesaPayment(input: {
  orderReference: string;
}) {
  const orderReference = input.orderReference
    .trim()
    .slice(0, 80);

  if (!/^[A-Za-z0-9]+$/.test(orderReference)) {
    throw new Error("Invalid ClickPesa order reference.");
  }

  const verified =
    await getClickPesaPaymentStatus(orderReference);

  if (
    String(verified.orderReference || "") !==
    orderReference
  ) {
    throw new Error(
      "ClickPesa order reference does not match.",
    );
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
    WHERE payment.provider_reference = ${orderReference}
      AND payment.provider = 'clickpesa'
    ORDER BY payment.created_at DESC
    LIMIT 1
  `;

  const record = rows[0];

  if (!record?.orderId || !record?.paymentId) {
    throw new Error(
      "No WHOKEAS order matches this ClickPesa payment reference.",
    );
  }

  const status = String(verified.status || "")
    .trim()
    .toUpperCase();

  const paidAmount = roundMoney(
    verified.collectedAmount,
  );

  const expectedAmount = roundMoney(record.total);
  const paidCurrency = String(
    verified.collectedCurrency || "",
  ).toUpperCase();
  const expectedCurrency = String(
    record.currency || "",
  ).toUpperCase();

  const raw = JSON.stringify({
    clickPesaVerification: verified,
    verifiedAt: new Date().toISOString(),
  });

  if (["SUCCESS", "SETTLED"].includes(status)) {
    if (paidCurrency !== expectedCurrency) {
      throw new Error(
        "ClickPesa payment currency does not match the order.",
      );
    }

    if (paidAmount + 0.009 < expectedAmount) {
      throw new Error(
        "ClickPesa payment amount is lower than the order total.",
      );
    }

    if (
      ["cancelled", "refunded"].includes(
        String(record.orderStatus),
      )
    ) {
      throw new Error(
        "This order can no longer be marked paid automatically.",
      );
    }

    const alreadyPaid =
      String(record.paymentStatus) === "successful" &&
      ["paid", "processing", "fulfilled"].includes(
        String(record.orderStatus),
      );

    if (!alreadyPaid) {
      await sql.transaction([
        sql`
          UPDATE payments
          SET
            provider = 'clickpesa',
            status = 'successful',
            amount = ${paidAmount},
            raw_response =
              COALESCE(raw_response, '{}'::jsonb) ||
              ${raw}::jsonb,
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
    }

    const cjAutomation = alreadyPaid
      ? null
      : await autoSubmitPaidOrderToCJ(
          String(record.orderNumber),
        );

    return {
      state: "success" as const,
      orderId: String(record.orderId),
      orderNumber: String(record.orderNumber),
      orderReference,
      amount: paidAmount,
      currency: paidCurrency,
      alreadyPaid,
      cjAutomation,
    };
  }

  if (["REFUNDED", "REVERSED"].includes(status)) {
    await sql.transaction([
      sql`
        UPDATE payments
        SET
          provider = 'clickpesa',
          status = 'refunded',
          raw_response =
            COALESCE(raw_response, '{}'::jsonb) ||
            ${raw}::jsonb
        WHERE id = ${String(record.paymentId)}
      `,
      sql`
        UPDATE orders
        SET
          status = 'refunded',
          updated_at = NOW()
        WHERE id = ${String(record.orderId)}
          AND status::text IN (
            'pending_payment',
            'paid',
            'processing'
          )
      `,
    ]);

    return {
      state: "reversed" as const,
      orderNumber: String(record.orderNumber),
      orderReference,
    };
  }

  if (status === "FAILED") {
    await sql`
      UPDATE payments
      SET
        provider = 'clickpesa',
        status = 'failed',
        raw_response =
          COALESCE(raw_response, '{}'::jsonb) ||
          ${raw}::jsonb
      WHERE id = ${String(record.paymentId)}
    `;

    return {
      state: "failed" as const,
      orderNumber: String(record.orderNumber),
      orderReference,
    };
  }

  await sql`
    UPDATE payments
    SET
      provider = 'clickpesa',
      raw_response =
        COALESCE(raw_response, '{}'::jsonb) ||
        ${raw}::jsonb
    WHERE id = ${String(record.paymentId)}
  `;

  return {
    state: "pending" as const,
    orderNumber: String(record.orderNumber),
    orderReference,
  };
}
