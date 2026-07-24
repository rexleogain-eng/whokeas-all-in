export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  hashOrderAccessKey,
  safeEqualHex,
  getCustomerSession,
  ensureCustomerSchema,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{
    orderNumber: string;
  }>;
};

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    await ensureCustomerSchema();

    const { orderNumber: rawOrderNumber } =
      await context.params;

    const orderNumber =
      decodeURIComponent(rawOrderNumber)
        .trim()
        .toUpperCase();

    const body = (await request.json()) as {
      reference?: string;
      accessKey?: string;
    };

    const reference =
      typeof body.reference === "string"
        ? body.reference.trim().slice(0, 180)
        : "";

    const accessKey =
      typeof body.accessKey === "string"
        ? body.accessKey.trim().slice(0, 200)
        : "";

    if (reference.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid transaction reference.",
        },
        { status: 400 },
      );
    }

    const sql = catalogSql();

    const rows = await sql`
      SELECT
        order_record.id::text AS id,
        order_record.customer_id::text AS "customerId",
        order_record.order_access_token_hash AS "accessHash",
        payment.provider
      FROM orders order_record

      LEFT JOIN LATERAL (
        SELECT provider
        FROM payments
        WHERE order_id = order_record.id
        ORDER BY created_at DESC
        LIMIT 1
      ) payment ON TRUE

      WHERE order_record.order_number = ${orderNumber}
      LIMIT 1
    `;

    const order = rows[0];

    if (!order?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found.",
        },
        { status: 404 },
      );
    }

    const session =
      await getCustomerSession();

    const sessionAllowed =
      session?.customer.id &&
      order.customerId &&
      session.customer.id ===
        String(order.customerId);

    const keyAllowed =
      accessKey &&
      safeEqualHex(
        String(order.accessHash || ""),
        hashOrderAccessKey(accessKey),
      );

    if (!sessionAllowed && !keyAllowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The secure order link is invalid or expired.",
        },
        { status: 403 },
      );
    }

    if (
      order.provider !==
        "manual_mobile_money" &&
      order.provider !==
        "manual_bank_transfer"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This payment method does not require a transaction reference.",
        },
        { status: 409 },
      );
    }

    try {
      await sql`
        UPDATE payments
        SET provider_reference = ${reference}
        WHERE order_id = ${String(order.id)}
      `;
    }
    catch (error) {
      if (
        error instanceof Error &&
        error.message
          .toLowerCase()
          .includes("unique")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "That reference is already attached to another order.",
          },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({
      ok: true,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not submit the payment reference.",
      },
      { status: 500 },
    );
  }
}