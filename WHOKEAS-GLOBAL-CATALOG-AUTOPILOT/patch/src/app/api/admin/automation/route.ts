import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  getAutomationDashboardData,
  saveAutomationSettings,
} from "@/lib/catalog-automation";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const data = await getAutomationDashboardData();
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load automation settings.",
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
    const config = await saveAutomationSettings(body.config ?? body);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save automation settings.",
      },
      { status: 500 },
    );
  }
}
