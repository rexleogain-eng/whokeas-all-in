import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  getStorefrontCatalogHealth,
  repairHiddenStorefrontProducts,
} from "@/lib/storefront-catalog-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const health = await getStorefrontCatalogHealth();
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Storefront catalogue audit failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    let limit = 5;
    try {
      const body = (await request.json()) as { limit?: number };
      if (body?.limit !== undefined) limit = Number(body.limit);
    } catch {
      // Default batch size is used when there is no JSON body.
    }

    const report = await repairHiddenStorefrontProducts(limit);
    const health = await getStorefrontCatalogHealth();
    return NextResponse.json({ ok: true, report, health });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Storefront catalogue repair failed.",
      },
      { status: 500 },
    );
  }
}
