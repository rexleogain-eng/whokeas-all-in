import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  listProducts,
  saveProduct,
  type ProductPayload,
} from "@/lib/product-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      products: await listProducts(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not load products.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const id = await saveProduct((await request.json()) as ProductPayload);

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create product.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("slug") ? 409 : 400 },
    );
  }
}