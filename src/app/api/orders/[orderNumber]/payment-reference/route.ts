import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = decodeURIComponent(rawOrderNumber)
      .trim()
      .toUpperCase();

    const body = (await request.json()) as { reference?: string };
    const reference =
      typeof body.reference === "string"
        ? body.reference.trim().slice(0, 180)
        : "";

    if (reference.length < 4) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid transaction reference." },
        { status: 400 },
      );
    }

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT o.id, p.provider
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT provider
        FROM payments
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      WHERE o.order_number = ${orderNumber}
      LIMIT 1
    `;

    const order = rows[0];

    if (!order?.id) {
      return NextResponse.json(
        { ok: false, error: "Order not found." },
        { status: 404 },
      );
    }

    if (
      order.provider !== "manual_mobile_money" &&
      order.provider !== "manual_bank_transfer"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This order does not require a transaction reference.",
        },
        { status: 409 },
      );
    }

    try {
      await sql`
        UPDATE payments
        SET provider_reference = ${reference}
        WHERE order_id = ${order.id}
      `;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("unique")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "That reference is already attached to another order.",
          },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not submit reference.",
      },
      { status: 500 },
    );
  }
}