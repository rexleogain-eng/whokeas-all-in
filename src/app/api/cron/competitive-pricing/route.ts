import { NextResponse } from "next/server";

import { runCompetitiveRepricing } from "@/lib/competitive-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
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
    const report = await runCompetitiveRepricing({ trigger: "cron" });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Competitive pricing cron failed.",
      },
      { status: 500 },
    );
  }
}
