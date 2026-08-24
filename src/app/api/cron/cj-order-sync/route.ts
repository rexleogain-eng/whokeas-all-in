import { NextResponse } from "next/server";

import { syncPendingCJFulfillments } from "@/lib/cj-fulfillment";
import { recoverPaidOrdersMissingCJ } from "@/lib/paid-order-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const recovery = await recoverPaidOrdersMissingCJ(10);
    const sync = await syncPendingCJFulfillments(15);
    return NextResponse.json({ ok: true, recovery, sync });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled CJ order synchronization failed.",
      },
      { status: 500 },
    );
  }
}
