import { NextResponse } from "next/server";

import { syncCJProducts } from "@/lib/cj-sync";
import { repairHiddenStorefrontProducts } from "@/lib/storefront-catalog-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const sync = await syncCJProducts(10);
    const storefrontRepair = await repairHiddenStorefrontProducts(5);
    return NextResponse.json({ ok: true, sync, storefrontRepair });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled CJ synchronization failed.",
      },
      { status: 500 },
    );
  }
}
