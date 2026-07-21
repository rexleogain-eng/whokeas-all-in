import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getCJAccessToken, pricingDefaults } from "@/lib/cj";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    await getCJAccessToken();

    return NextResponse.json({
      ok: true,
      connected: true,
      defaults: pricingDefaults(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ connection failed.",
        defaults: pricingDefaults(),
      },
      { status: 500 },
    );
  }
}