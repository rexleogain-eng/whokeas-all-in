import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { setCatalogueExpansionPaused } from "@/lib/catalogue-expansion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const config = await setCatalogueExpansionPaused(body.paused === true);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not change catalogue status.",
      },
      { status: 500 },
    );
  }
}
