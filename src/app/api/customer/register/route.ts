export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  createCustomerSession,
  ensureCustomerSchema,
  hashCustomerPassword,
  linkGuestOrders,
  normalizeCustomerEmail,
  setCustomerSessionCookie,
  validCustomerEmail,
  validateCustomerPassword,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";
import { ensureGrowthSchema } from "@/lib/growth-revenue";

export async function POST(request: Request) {
  try {
    await ensureCustomerSchema();
    await ensureGrowthSchema();

    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
    };

    const fullName = String(
      body.fullName || "",
    ).trim().slice(0, 160);

    const email = normalizeCustomerEmail(
      body.email,
    );

    const password = String(
      body.password || "",
    );

    if (fullName.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter your full name.",
        },
        { status: 400 },
      );
    }

    if (!validCustomerEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid email address.",
        },
        { status: 400 },
      );
    }

    const passwordError =
      validateCustomerPassword(password);

    if (passwordError) {
      return NextResponse.json(
        {
          ok: false,
          error: passwordError,
        },
        { status: 400 },
      );
    }

    const sql = catalogSql();

    const existing = await sql`
      SELECT id
      FROM customers
      WHERE email = ${email}
      LIMIT 1
    `;

    if (existing[0]?.id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An account already exists for this email. Sign in instead.",
        },
        { status: 409 },
      );
    }

    const customerId = randomUUID();

    await sql`
      INSERT INTO customers (
        id,
        email,
        full_name,
        password_hash,
        country_code,
        preferred_currency,
        preferred_locale,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${customerId},
        ${email},
        ${fullName},
        ${hashCustomerPassword(password)},
        'TZ',
        'TZS',
        'en-TZ',
        'active',
        NOW(),
        NOW()
      )
    `;

    await linkGuestOrders(customerId, email);

    const session =
      await createCustomerSession(customerId);

    const response = NextResponse.json(
      {
        ok: true,
        customer: {
          id: customerId,
          email,
          fullName,
        },
      },
      { status: 201 },
    );

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
            : "Could not create the customer account.",
      },
      { status: 500 },
    );
  }
}