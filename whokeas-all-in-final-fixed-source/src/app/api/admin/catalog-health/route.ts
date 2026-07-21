import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    await ensureCatalogSchema();
    const sql = catalogSql();
    const [health] = await sql`
      SELECT
        current_database() AS database,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM product_variants) AS variants,
        (SELECT COUNT(*)::int FROM product_images) AS images,
        (SELECT COUNT(*)::int FROM products WHERE status::text = 'draft') AS drafts,
        (SELECT COUNT(*)::int FROM products WHERE status::text = 'active') AS active
    `;

    return NextResponse.json({ ok: true, health });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
