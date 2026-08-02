export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  ensureCustomerSchema,
  getCustomerSession,
} from "@/lib/customer-auth";

import { catalogSql } from "@/lib/catalog-schema";
import {
  ensureGrowthSchema,
  getCustomerGrowthBenefits,
} from "@/lib/growth-revenue";

export async function GET() {
  try {
    await ensureCustomerSchema();
    await ensureGrowthSchema();

    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
      });
    }

    const sql = catalogSql();

    const [addresses, growth] = await Promise.all([
      sql`
      SELECT
        id::text AS id,
        recipient_name AS "recipientName",
        phone,
        country_code AS "countryCode",
        country_name AS "countryName",
        region,
        city,
        postal_code AS "postalCode",
        address_line_1 AS "addressLine1",
        address_line_2 AS "addressLine2"
      FROM customer_addresses
      WHERE customer_id = ${session.customer.id}
      ORDER BY
        is_default DESC,
        updated_at DESC
      LIMIT 1
      `,
      getCustomerGrowthBenefits(
        session.customer.id,
      ),
    ]);

    return NextResponse.json({
      ok: true,
      authenticated: true,
      customer: session.customer,
      address: addresses[0] || null,
      growth,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load the customer profile.",
      },
      { status: 500 },
    );
  }
}