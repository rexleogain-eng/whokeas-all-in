export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  getCatalogueExpansionDashboard,
  saveCatalogueExpansionSettings,
} from "@/lib/catalogue-expansion";
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const dashboard = await getCatalogueExpansionDashboard();
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load catalogue expansion.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const config = await saveCatalogueExpansionSettings(body.config ?? body);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save catalogue expansion settings.",
      },
      { status: 500 },
    );
  }
}
