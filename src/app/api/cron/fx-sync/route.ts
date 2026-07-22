import { NextResponse } from "next/server";

import { getAutomationSettings } from "@/lib/catalog-automation";
import { syncFxRates } from "@/lib/global-markets";

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
    const config = await getAutomationSettings();
    const result = await syncFxRates({
      force: true,
      refreshHours: config.fxRefreshHours,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled currency synchronization failed.",
      },
      { status: 500 },
    );
  }
}
