export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  createCustomerSession,
  ensureCustomerSchema,
  linkGuestOrders,
  normalizeCustomerEmail,
  setCustomerSessionCookie,
  verifyCustomerPassword,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";

export async function POST(request: Request) {
  try {
    await ensureCustomerSchema();

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = normalizeCustomerEmail(
      body.email,
    );

    const password = String(
      body.password || "",
    );

    const sql = catalogSql();

    const rows = await sql`
      SELECT
        id::text AS id,
        email,
        full_name AS "fullName",
        password_hash AS "passwordHash",
        status,
        failed_login_attempts AS "failedAttempts",
        locked_until AS "lockedUntil"
      FROM customers
      WHERE email = ${email}
      LIMIT 1
    `;

    const customer = rows[0];

    const isLocked =
      customer?.lockedUntil &&
      new Date(
        String(customer.lockedUntil),
      ).getTime() > Date.now();

    if (isLocked) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Too many unsuccessful attempts. Try again in 15 minutes.",
        },
        { status: 429 },
      );
    }

    const valid =
      customer?.id &&
      customer.status === "active" &&
      verifyCustomerPassword(
        password,
        String(customer.passwordHash || ""),
      );

    if (!valid) {
      if (customer?.id) {
        await sql`
          UPDATE customers
          SET
            failed_login_attempts =
              failed_login_attempts + 1,

            locked_until = CASE
              WHEN failed_login_attempts + 1 >= 5
              THEN NOW() + INTERVAL '15 minutes'
              ELSE locked_until
            END,

            updated_at = NOW()
          WHERE id = ${String(customer.id)}
        `;
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    await sql`
      UPDATE customers
      SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = ${String(customer.id)}
    `;

    await linkGuestOrders(
      String(customer.id),
      String(customer.email),
    );

    const session = await createCustomerSession(
      String(customer.id),
    );

    const response = NextResponse.json({
      ok: true,
      customer: {
        id: String(customer.id),
        email: String(customer.email),
        fullName: String(customer.fullName),
      },
    });

    setCustomerSessionCookie(
      response,
      session.token,
    );

    return response;
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Customer sign-in failed.",
      },
      { status: 500 },
    );
  }
}