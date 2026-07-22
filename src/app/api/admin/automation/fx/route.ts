import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getAutomationSettings } from "@/lib/catalog-automation";
import { syncFxRates } from "@/lib/global-markets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) {
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
            : "Currency synchronization failed.",
      },
      { status: 500 },
    );
  }
}
