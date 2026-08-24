import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  cleanupBlockedCJProducts,
  repairHiddenCJProductsSequential,
} from "@/lib/cj-catalog-maintenance";
import { getStorefrontCatalogHealth } from "@/lib/storefront-catalog-health";

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
    let limit = 20;
    let action: "repair" | "cleanup" = "repair";

    try {
      const body = (await request.json()) as {
        limit?: number;
        action?: "repair" | "cleanup";
      };
      if (body?.limit !== undefined) limit = Number(body.limit);
      if (body?.action === "cleanup") action = "cleanup";
    } catch {
      // Defaults are used when there is no JSON body.
    }

    if (action === "cleanup") {
      const cleanup = await cleanupBlockedCJProducts(limit || 100);
      const health = await getStorefrontCatalogHealth();
      return NextResponse.json({ ok: true, cleanup, health });
    }

    const report = await repairHiddenCJProductsSequential(limit || 20);
    const health = await getStorefrontCatalogHealth();
    return NextResponse.json({ ok: true, report, health });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Storefront catalogue maintenance failed.",
      },
      { status: 500 },
    );
  }
}
