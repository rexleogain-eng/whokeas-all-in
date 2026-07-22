import { NextResponse } from "next/server";

import { runCatalogAutomation } from "@/lib/catalog-automation";

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
    const report = await runCatalogAutomation({ trigger: "cron" });
    return NextResponse.json({
      ok: report.status !== "failed",
      report,
    }, { status: report.status === "failed" ? 500 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled catalogue automation failed.",
      },
      { status: 500 },
    );
  }
}
