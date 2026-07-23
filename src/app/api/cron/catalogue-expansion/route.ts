export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { runDailyCatalogueExpansion } from "@/lib/catalogue-expansion";
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized cron request." },
      { status: 401 },
    );
  }

  try {
    const report = await runDailyCatalogueExpansion();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Catalogue expansion cron failed.",
      },
      { status: 500 },
    );
  }
}
