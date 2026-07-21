import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { ensureCatalogSchema } from "@/lib/catalog-schema";
import {
  getSql,
  saveProduct,
  type ProductPayload,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    await saveProduct((await request.json()) as ProductPayload, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update product.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("slug") ? 409 : 400 },
    );
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    await ensureCatalogSchema();
    const sql = getSql();

    const history = await sql`
      SELECT COUNT(*)::int AS count
      FROM order_items
      WHERE product_id = ${id}
    `;

    if (Number(history[0]?.count ?? 0) > 0) {
      await sql`
        UPDATE products
        SET status = 'archived', updated_at = NOW()
        WHERE id = ${id}
      `;

      return NextResponse.json({ ok: true, mode: "archived" });
    }

    await sql.transaction([
      sql`DELETE FROM product_images WHERE product_id = ${id}`,
      sql`DELETE FROM product_variants WHERE product_id = ${id}`,
      sql`DELETE FROM products WHERE id = ${id}`,
    ]);

    return NextResponse.json({ ok: true, mode: "deleted" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not remove product.",
      },
      { status: 500 },
    );
  }
}