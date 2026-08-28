import { NextRequest, NextResponse } from "next/server";

import { backfillCJMerchantIdentifiers } from "@/lib/cj-identifier-backfill";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await backfillCJMerchantIdentifiers(50);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("CJ merchant identifier backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown CJ identifier backfill error.",
      },
      { status: 500 },
    );
  }
}
