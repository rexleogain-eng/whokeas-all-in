export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  trackGrowthAttribution,
} from "@/lib/growth-revenue";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      visitorId?: string;
      landingPath?: string;
      referrer?: string;
    };

    const result = await trackGrowthAttribution({
      code: String(body.code || ""),
      visitorId: String(body.visitorId || ""),
      landingPath: body.landingPath,
      referrer: body.referrer,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  }
  catch {
    return NextResponse.json({
      ok: true,
      recognized: false,
    });
  }
}
